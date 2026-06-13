import { join } from 'node:path';
import type { AwsConfig, AwsOutputs } from './aws-config.ts';
import { terraformPath } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

const TF_PLAN = 'company-brain-aws.tfplan';

export async function applyAwsTerraform(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<AwsOutputs> {
  const terraform = config.terraformCommand ?? 'terraform';
  const env = terraformEnv(config);
  const vars = terraformVarArgs(config);

  await runVisible([terraform, 'init', '-backend=false', '-input=false'], context, {
    cwd: terraformPath,
    approve: true,
    purpose: 'Initialize local Terraform state.',
  });

  await runVisible([terraform, 'plan', '-input=false', `-out=${TF_PLAN}`, ...vars], context, {
    cwd: terraformPath,
    env,
    purpose: 'Create the AWS infrastructure plan.',
  });

  if (await terraformPlanDeletes(terraform, context)) {
    await runVisible([terraform, 'show', TF_PLAN], context, { cwd: terraformPath });
    await runVisible([terraform, 'apply', '-input=false', TF_PLAN], context, {
      cwd: terraformPath,
      env,
      approve: true,
      purpose: 'The plan deletes or replaces resources. Review carefully before approving.',
    });
  } else {
    await runVisible([terraform, 'apply', '-input=false', TF_PLAN], context, {
      cwd: terraformPath,
      env,
      approve: true,
      purpose: 'Apply the AWS infrastructure plan.',
    });
  }

  return await readTerraformOutputs(terraform, context);
}

export async function readTerraformOutputs(
  terraformCommand: string,
  context: VisibleCommandContext,
): Promise<AwsOutputs> {
  const output = await runVisible([terraformCommand, 'output', '-json'], context, {
    cwd: terraformPath,
    capture: true,
  });
  const parsed = JSON.parse(output) as Record<string, { value?: unknown }>;

  return {
    publicIp: outputValue(parsed, 'public_ip'),
    publicIpv6: optionalOutputValue(parsed, 'public_ipv6'),
    nangoEcrRepositoryUrl: outputValue(parsed, 'nango_ecr_repository_url'),
    brainEcrRepositoryUrl: outputValue(parsed, 'brain_ecr_repository_url'),
    pgBackupEcrRepositoryUrl: outputValue(parsed, 'pg_backup_ecr_repository_url'),
    artifactsBucket: outputValue(parsed, 'artifacts_bucket'),
    instanceId: outputValue(parsed, 'instance_id'),
    dataVolumeId: outputValue(parsed, 'data_volume_id'),
    deployGroupTag: outputValue(parsed, 'deploy_group_tag'),
  };
}

function terraformEnv(config: AwsConfig): Record<string, string> {
  return {
    TF_VAR_google_client_id: config.googleClientId,
    TF_VAR_google_client_secret: config.secrets.googleClientSecret ?? '',
  };
}

function terraformVarArgs(config: AwsConfig): string[] {
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
