import { join } from 'node:path';
import type { AwsConfig, AwsOutputs } from './aws-config.ts';
import { exportAwsCredentials } from './aws-credential-export.ts';
import {
  type AwsCredentialConfig,
  awsSdkEnv,
  hasExportedAwsCredentials,
  withAwsCredentials,
} from './aws-credentials.ts';
import { ensureTerraformStateBackend, terraformBackendConfigArgs } from './aws-terraform-state.ts';
import { terraformPath } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

const TF_PLAN = 'company-brain-aws.tfplan';
const TF_DESTROY_PLAN = 'company-brain-aws-destroy.tfplan';
const LEGACY_DEFAULT_NETWORKING_RESOURCES = [
  'aws_default_subnet.app',
  'aws_route.ipv6_default',
  'aws_vpc_ipv6_cidr_block_association.default',
] as const;

export async function applyAwsTerraform(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<AwsOutputs> {
  const terraform = config.terraformCommand ?? 'terraform';
  const vars = terraformVarArgs(config);
  const backend = await ensureTerraformStateBackend(config, context);
  let terraformConfig = await withFreshAwsCredentials(config, context);

  await runVisible(
    [
      terraform,
      'init',
      '-reconfigure',
      '-input=false',
      ...terraformBackendConfigArgs(
        backend,
        hasExportedAwsCredentials(terraformConfig) ? undefined : config.awsProfile,
      ),
    ],
    context,
    {
      cwd: terraformPath,
      env: terraformEnv(terraformConfig),
      approve: true,
      purpose: 'Initialize Terraform S3 state backend.',
    },
  );

  terraformConfig = await withFreshAwsCredentials(config, context);
  await forgetLegacyDefaultNetworking(terraform, terraformConfig, context);

  terraformConfig = await withFreshAwsCredentials(config, context);
  await runVisible([terraform, 'plan', '-input=false', `-out=${TF_PLAN}`, ...vars], context, {
    cwd: terraformPath,
    env: terraformEnv(terraformConfig),
    purpose: 'Create the AWS infrastructure plan.',
  });

  if (await terraformPlanDeletes(terraform, context)) {
    await runVisible([terraform, 'show', TF_PLAN], context, { cwd: terraformPath });
    terraformConfig = await withFreshAwsCredentials(config, context);
    await runVisible([terraform, 'apply', '-input=false', TF_PLAN], context, {
      cwd: terraformPath,
      env: terraformEnv(terraformConfig),
      approve: true,
      purpose: 'The plan deletes or replaces resources. Review carefully before approving.',
    });
  } else {
    terraformConfig = await withFreshAwsCredentials(config, context);
    await runVisible([terraform, 'apply', '-input=false', TF_PLAN], context, {
      cwd: terraformPath,
      env: terraformEnv(terraformConfig),
      approve: true,
      purpose: 'Apply the AWS infrastructure plan.',
    });
  }

  terraformConfig = await withFreshAwsCredentials(config, context);
  return await readTerraformOutputs(terraform, context, terraformConfig);
}

export async function readTerraformOutputs(
  terraformCommand: string,
  context: VisibleCommandContext,
  config?: AwsCredentialConfig,
): Promise<AwsOutputs> {
  const output = await runVisible([terraformCommand, 'output', '-json'], context, {
    cwd: terraformPath,
    capture: true,
    env: config ? awsSdkEnv(config) : undefined,
  });
  const parsed = JSON.parse(output) as Record<string, { value?: unknown }>;

  return {
    publicIp: outputValue(parsed, 'public_ip'),
    publicIpv6: optionalOutputValue(parsed, 'public_ipv6'),
    artifactsBucket: outputValue(parsed, 'artifacts_bucket'),
    instanceId: outputValue(parsed, 'instance_id'),
    dataVolumeId: outputValue(parsed, 'data_volume_id'),
    deployGroupTag: outputValue(parsed, 'deploy_group_tag'),
  };
}

export function terraformEnv(config: AwsConfig): Record<string, string | undefined> {
  return {
    ...awsSdkEnv(config),
    TF_VAR_google_client_id: config.googleClientId,
    TF_VAR_google_client_secret: config.secrets.googleClientSecret ?? '',
    TF_VAR_allowed_dashboard_accounts_emails: config.allowedDashboardAccountsEmails,
  };
}

async function withFreshAwsCredentials(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<AwsConfig & AwsCredentialConfig> {
  return withAwsCredentials(config, {
    awsCredentials: await exportAwsCredentials(config, context),
  });
}

export function terraformVarArgs(config: AwsConfig): string[] {
  return [
    terraformVar('region', config.region),
    terraformVar('environment', config.environment),
    terraformVar('instance_type', config.instanceType),
    terraformVar('root_volume_size', config.rootVolumeSize),
    terraformVar('data_volume_size', config.dataVolumeSize),
    terraformVar('ssm_secret_prefix', config.ssmSecretPrefix),
    terraformVar('enable_github_deploy', false),
    terraformVar('hostname', config.nangoHostname),
    terraformVar('nango_hostname', config.nangoHostname),
    terraformVar('nango_connect_hostname', config.nangoConnectHostname),
    terraformVar('brain_hostname', config.brainHostname),
    terraformVar('dozzle_hostname', config.dozzleHostname),
  ];
}

function terraformVar(key: string, value: string | number | boolean): string {
  return `-var=${key}=${value}`;
}

async function forgetLegacyDefaultNetworking(
  terraform: string,
  config: AwsConfig & AwsCredentialConfig,
  context: VisibleCommandContext,
): Promise<void> {
  let stateList = '';
  try {
    stateList = await runVisible([terraform, 'state', 'list'], context, {
      cwd: terraformPath,
      env: terraformEnv(config),
      capture: true,
      purpose: 'Check for legacy default-VPC resources in Terraform state.',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes('No state file was found')) {
      console.log('No Terraform state exists yet; continuing.');
      return;
    }
    throw error;
  }

  const resources = legacyDefaultNetworkingResourcesInState(stateList);
  if (resources.length === 0) {
    console.log('No legacy default-VPC resources are tracked in Terraform state; continuing.');
    return;
  }

  for (const resource of resources) {
    await runVisible([terraform, 'state', 'rm', resource], context, {
      cwd: terraformPath,
      env: terraformEnv(config),
      approve: true,
      purpose: `Stop managing legacy default-VPC resource ${resource}. This does not delete AWS infrastructure.`,
    });
  }
}

export function legacyDefaultNetworkingResourcesInState(stateList: string): string[] {
  const resources = new Set(stateList.split('\n').map((line) => line.trim()));
  return LEGACY_DEFAULT_NETWORKING_RESOURCES.filter((resource) => resources.has(resource));
}

async function terraformPlanDeletes(
  terraform: string,
  context: VisibleCommandContext,
): Promise<boolean> {
  const output = await runVisible([terraform, 'show', '-json', TF_PLAN], context, {
    cwd: terraformPath,
    capture: true,
  });
  const plan = JSON.parse(output) as {
    resource_changes?: { change?: { actions?: string[] } }[];
  };

  return (
    plan.resource_changes?.some((change) => change.change?.actions?.includes('delete')) ?? false
  );
}

function outputValue(parsed: Record<string, { value?: unknown }>, key: string): string {
  const value = parsed[key]?.value;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Terraform output ${key} is missing.`);
  }

  return value;
}

function optionalOutputValue(
  parsed: Record<string, { value?: unknown }>,
  key: string,
): string | undefined {
  const value = parsed[key]?.value;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function terraformPlanPath(): string {
  return join(terraformPath, TF_PLAN);
}

export function terraformDestroyPlanPath(): string {
  return join(terraformPath, TF_DESTROY_PLAN);
}
