import { confirm, isCancel, note, password, select, text } from '@clack/prompts';
import type { AwsConfig } from './aws-config.ts';
import { normalizeAwsEnvironment, validateAwsEnvironment } from './aws-environment.ts';
import {
  type AwsHostnames,
  deriveAwsHostnames,
  inferBaseDomain,
  pickAwsHostnames,
  sameAwsHostnames,
} from './aws-hostnames.ts';
import {
  AWS_DATA_VOLUME_SIZE_OPTIONS,
  AWS_INSTANCE_TYPE_OPTIONS,
  AWS_REGION_OPTIONS,
  AWS_ROOT_VOLUME_SIZE_OPTIONS,
  type AwsPromptOption,
  DEFAULT_AWS_INSTANCE_TYPE,
  DEFAULT_AWS_REGION,
  DEFAULT_DATA_VOLUME_SIZE_GB,
  DEFAULT_ROOT_VOLUME_SIZE_GB,
  optionsWithCurrent,
} from './aws-prompt-options.ts';
import { randomToken } from './secrets.ts';

const WEBHOOK_SECRET_BYTES = 32;

export async function collectAwsConfig({
  existing,
  force,
  nonInteractive,
}: {
  existing?: AwsConfig;
  force?: boolean;
  nonInteractive?: boolean;
}): Promise<AwsConfig> {
  if (nonInteractive && !existing) {
    throw new Error(
      'Deployment setup needs prompts. Run interactively once, or keep .company-brain.aws.json.',
    );
  }

  note(
    'Choose where this deployment lives and how public service hostnames are derived.',
    'AWS environment',
  );
  const region = await promptSelect(
    'AWS region',
    'Where AWS will create the EC2 instance, ECR repositories, S3 bucket, and SSM parameters.',
    AWS_REGION_OPTIONS,
    existing?.region ?? DEFAULT_AWS_REGION,
    force,
    nonInteractive,
  );
  const environment = await promptEnvironment(
    'Environment name',
    'Short name used in AWS resource names, SSM paths, and derived hostnames.',
    existing?.environment ?? 'dev',
    force,
    nonInteractive,
  );
  const baseDomain = await promptHostname(
    'Base domain for service hostnames',
    'DNS zone or domain suffix used to derive nango-ENV, brain-ENV, and logs hostnames.',
    existing?.baseDomain ?? inferBaseDomain(existing) ?? 'example.com',
    force,
    nonInteractive,
  );
  const hostnames = await promptHostnames(existing, environment, baseDomain, force, nonInteractive);

  note(
    [
      `Nango: https://${hostnames.nangoHostname}`,
      `Nango Connect: https://${hostnames.nangoConnectHostname}`,
      `Brain: https://${hostnames.brainHostname}`,
      `Dozzle logs: https://${hostnames.dozzleHostname}`,
      '',
      `Brain Google OAuth redirect URI: https://${hostnames.brainHostname}/api/auth/callback/google`,
      `Nango provider OAuth callback URL: https://${hostnames.nangoHostname}/oauth/callback`,
    ].join('\n'),
    'Service URLs',
  );

  note(
    'Size the single EC2 host and its disks. Persistent app data lives on the data volume.',
    'AWS compute and storage',
  );
  const instanceType = await promptSelect(
    'EC2 instance type',
    'Compute size for the single EC2 host running Nango, Brain, Postgres, Redis, Elasticsearch, Caddy, and Dozzle.',
    AWS_INSTANCE_TYPE_OPTIONS,
    existing?.instanceType ?? DEFAULT_AWS_INSTANCE_TYPE,
    force,
    nonInteractive,
  );
  const rootVolumeSize = await promptSelect(
    'Root volume size in GB',
    'OS and Docker image-layer disk. App data lives on the persistent data volume.',
    AWS_ROOT_VOLUME_SIZE_OPTIONS,
    existing?.rootVolumeSize ?? DEFAULT_ROOT_VOLUME_SIZE_GB,
    force,
    nonInteractive,
  );
  const dataVolumeSize = await promptSelect(
    'Persistent data volume size in GB',
    'Durable EBS volume mounted at /data for Postgres, Elasticsearch, and Caddy certificates.',
    AWS_DATA_VOLUME_SIZE_OPTIONS,
    existing?.dataVolumeSize ?? DEFAULT_DATA_VOLUME_SIZE_GB,
    force,
    nonInteractive,
  );

  note(
    'Caddy uses ACME certificates, and DNS must point at the AWS instance before HTTPS can issue.',
    'TLS and DNS',
  );
  const acmeEmail = await promptText(
    'ACME certificate email',
    "Email address Caddy gives Let's Encrypt for certificate notices and recovery.",
    existing?.acmeEmail ?? '',
    force,
    nonInteractive,
  );
  const dns = await promptDns(existing, force, nonInteractive);

  note('Configure who can sign in to the Brain web app.', 'Brain sign-in');
  const workspaceDomain = await promptText(
    'Google Workspace domain allowed to sign in',
    'Only Google accounts from this domain can sign in to the Brain web app.',
    existing?.workspaceDomain ?? 'example.com',
    force,
    nonInteractive,
  );
  const googleClientId = await promptText(
    'Brain Google OAuth client ID',
    'OAuth client ID from Google Cloud for Brain sign-in. Use the Brain redirect URI shown above.',
    existing?.googleClientId ?? '',
    force,
    nonInteractive,
  );
  const googleClientSecret = await promptSecret(
    'Brain Google OAuth client secret',
    'OAuth client secret from the same Google Cloud OAuth client used for Brain sign-in.',
    existing?.secrets.googleClientSecret,
    force,
    nonInteractive,
  );

  note('Create the admin account for the hosted container logs UI.', 'Dozzle logs');
  const dozzleUsername = await promptText(
    'Dozzle admin username',
    'Username for the hosted logs UI at the Dozzle hostname.',
    existing?.dozzleUsername ?? 'admin',
    force,
    nonInteractive,
  );
  const dozzleEmail = await promptText(
    'Dozzle admin email',
    'Email associated with the Dozzle logs UI admin user.',
    existing?.dozzleEmail ?? '',
    force,
    nonInteractive,
  );
  const dozzleName = await promptText(
    'Dozzle admin display name',
    'Display name shown inside the Dozzle logs UI.',
    existing?.dozzleName ?? 'Admin',
    force,
    nonInteractive,
  );
  const dozzlePassword = await promptSecret(
    'Dozzle admin password',
    'Password for the hosted Dozzle logs UI admin account.',
    existing?.secrets.dozzlePassword,
    force,
    nonInteractive,
  );

  const config: AwsConfig = {
    version: 1,
    terraformCommand: existing?.terraformCommand,
    region,
    environment,
    baseDomain,
    instanceType,
    rootVolumeSize,
    dataVolumeSize,
    ssmSecretPrefix: ssmSecretPrefixForEnvironment(existing, environment),
    nangoHostname: hostnames.nangoHostname,
    nangoConnectHostname: hostnames.nangoConnectHostname,
    brainHostname: hostnames.brainHostname,
    dozzleHostname: hostnames.dozzleHostname,
    acmeEmail,
    workspaceDomain,
    googleClientId,
    dozzleUsername,
    dozzleEmail,
    dozzleName,
    agentSyncWebhookSecret: existing?.agentSyncWebhookSecret ?? randomToken(WEBHOOK_SECRET_BYTES),
    selectedIntegrationIds: existing?.selectedIntegrationIds ?? [],
    scopes: existing?.scopes ?? {},
    dns,
    outputs: existing?.outputs,
    lastDeployId: existing?.lastDeployId,
    appDeployedAt: existing?.appDeployedAt,
    nangoBootstrappedAt: existing?.nangoBootstrappedAt,
    syncsDeployedAt: existing?.syncsDeployedAt,
    secrets: {
      googleClientSecret,
      dozzlePassword,
      nangoSecretKey: existing?.secrets.nangoSecretKey,
      oauth: existing?.secrets.oauth ?? {},
    },
  };

  return config;
}

export async function confirmManualDnsReady(
  nonInteractive: boolean,
  autoApprove = false,
): Promise<boolean> {
  if (autoApprove) {
    return true;
  }

  if (nonInteractive) {
    return false;
  }

  const answer = await confirm({
    message: promptMessage(
      'Have you created the DNS records above?',
      'They must point the public service hostnames at the EC2 public IP before certificates can issue.',
    ),
    initialValue: false,
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  return Boolean(answer);
}

async function promptHostnames(
  existing: AwsConfig | undefined,
  environment: string,
  baseDomain: string,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<AwsHostnames> {
  const derived = deriveAwsHostnames(environment, baseDomain);
  const existingHostnames = existing && pickAwsHostnames(existing);

  if (nonInteractive) {
    return existingHostnames && !force ? existingHostnames : derived;
  }

  const customize = await confirm({
    message: promptMessage(
      'Customize service hostnames?',
      'Choose no to use hostnames derived from the environment and base domain.',
    ),
    initialValue: existingHostnames ? !sameAwsHostnames(existingHostnames, derived) : false,
  });

  if (isCancel(customize)) {
    throw new Error('Setup cancelled.');
  }

  if (!customize) {
    return derived;
  }

  return {
    nangoHostname: await promptHostname(
      'Nango hostname',
      'Public URL for the hosted Nango dashboard and API.',
      existing?.nangoHostname ?? derived.nangoHostname,
      force,
      nonInteractive,
    ),
    nangoConnectHostname: await promptHostname(
      'Nango Connect hostname',
      'Public URL for Nango Connect OAuth flows.',
      existing?.nangoConnectHostname ?? derived.nangoConnectHostname,
      force,
      nonInteractive,
    ),
    brainHostname: await promptHostname(
      'Brain hostname',
      'Public URL for the Company Brain backend and web app.',
      existing?.brainHostname ?? derived.brainHostname,
      force,
      nonInteractive,
    ),
    dozzleHostname: await promptHostname(
      'Dozzle logs hostname',
      'Public URL for the Dozzle container logs UI.',
      existing?.dozzleHostname ?? derived.dozzleHostname,
      force,
      nonInteractive,
    ),
  };
}

async function promptDns(
  existing: AwsConfig | undefined,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<AwsConfig['dns']> {
  if (existing && !force) {
    return existing.dns;
  }
  if (nonInteractive) {
    return existing?.dns ?? { mode: 'manual' };
  }

  const mode = await select({
    message: promptMessage(
      'How should the CLI handle DNS records?',
      'The deployment needs public A/AAAA records before HTTPS certificates can be issued.',
    ),
    options: [
      { value: 'manual', label: 'Manual DNS', hint: 'Print records for you to create elsewhere.' },
      {
        value: 'route53',
        label: 'Route53 hosted zone',
        hint: 'Let the CLI create records in an AWS hosted zone.',
      },
    ],
    initialValue: existing?.dns.mode ?? 'manual',
  });

  if (isCancel(mode)) {
    throw new Error('Setup cancelled.');
  }

  if (mode === 'manual') {
    return { mode };
  }

  return {
    mode,
    hostedZoneId: await promptText(
      'Route53 hosted zone ID',
      'Hosted zone ID for the base domain, used to upsert DNS records automatically.',
      existing?.dns.hostedZoneId ?? '',
      true,
      nonInteractive,
    ),
  };
}

async function promptText(
  message: string,
  description: string,
  defaultValue: string,
  _force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<string> {
  if (nonInteractive) {
    if (defaultValue) {
      return defaultValue;
    }
    throw new Error(`Missing required AWS setting: ${message}`);
  }

  const answer = await text({
    message: promptMessage(message, description),
    defaultValue,
    placeholder: defaultValue,
    validate: (value) => validateRequired(value, defaultValue),
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  const value = (answer || defaultValue).trim();
  if (!value) {
    throw new Error(`Missing required AWS setting: ${message}`);
  }

  return value;
}

async function promptHostname(
  message: string,
  description: string,
  defaultValue: string,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<string> {
  return stripProtocol(await promptText(message, description, defaultValue, force, nonInteractive));
}

async function promptEnvironment(
  message: string,
  description: string,
  defaultValue: string,
  _force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<string> {
  if (nonInteractive) {
    const validation = validateAwsEnvironment(defaultValue);
    if (validation) {
      throw new Error(`Invalid AWS setting ${message}: ${validation}`);
    }
    const value = normalizeAwsEnvironment(defaultValue);
    if (value) {
      return value;
    }
    throw new Error(`Missing required AWS setting: ${message}`);
  }

  const answer = await text({
    message: promptMessage(message, description),
    defaultValue,
    placeholder: defaultValue,
    validate: (value) => validateEnvironment(value, defaultValue),
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  const value = normalizeAwsEnvironment(answer || defaultValue);
  if (!value) {
    throw new Error(`Missing required AWS setting: ${message}`);
  }

  return value;
}

async function promptSelect<Value extends number | string>(
  message: string,
  description: string,
  options: readonly AwsPromptOption<Value>[],
  defaultValue: Value,
  _force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<Value> {
  if (nonInteractive) {
    return defaultValue;
  }

  type SelectOptions = Parameters<typeof select<Value>>[0]['options'];
  const selectOptions = optionsWithCurrent(options, defaultValue) as SelectOptions;

  const answer = await select({
    message: promptMessage(message, description),
    options: selectOptions,
    initialValue: defaultValue,
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  return answer;
}

async function promptSecret(
  message: string,
  description: string,
  existing: string | undefined,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<string> {
  if (existing && !force) {
    return existing;
  }
  if (nonInteractive) {
    throw new Error(`Missing required AWS secret: ${message}`);
  }

  const answer = await password({
    message: existing
      ? promptMessage(`${message} (press Enter to keep existing value)`, description)
      : promptMessage(message, description),
    validate: (value) => validateSecret(value, existing),
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  const value = answer || existing;
  if (!value) {
    throw new Error(`Missing required AWS secret: ${message}`);
  }

  return value;
}

function validateRequired(value: string | undefined, defaultValue?: string): string | undefined {
  if ((!value || value.trim().length === 0) && !defaultValue) {
    return 'Required';
  }

  return undefined;
}

function validateEnvironment(
  value: string | undefined,
  defaultValue: string | undefined,
): string | undefined {
  return validateAwsEnvironment(value || defaultValue || '');
}

function validateSecret(
  value: string | undefined,
  existing: string | undefined,
): string | undefined {
  if (!existing && (!value || value.trim().length === 0)) {
    return 'Required';
  }

  return undefined;
}

function promptMessage(message: string, description: string): string {
  return `${message}\n${description}`;
}

function ssmSecretPrefixForEnvironment(
  existing: AwsConfig | undefined,
  environment: string,
): string {
  if (!existing) {
    return defaultSsmSecretPrefix(environment);
  }

  const oldDefault = defaultSsmSecretPrefix(existing.environment);
  return existing.ssmSecretPrefix.toLowerCase() === oldDefault
    ? defaultSsmSecretPrefix(environment)
    : existing.ssmSecretPrefix;
}

function defaultSsmSecretPrefix(environment: string): string {
  return `/company-brain/${environment}`;
}

function stripProtocol(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}
