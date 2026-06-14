import { confirm, isCancel, multiselect, note, password, select, text } from '@clack/prompts';
import type { AwsConfig } from './aws-config.ts';
import {
  type AwsHostnames,
  deriveAwsHostnames,
  inferBaseDomain,
  pickAwsHostnames,
  sameAwsHostnames,
} from './aws-hostnames.ts';
import { nangoIntegrationSpecs } from './nango.ts';
import { randomToken } from './secrets.ts';

type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

const DEFAULT_VOLUME_SIZE_GB = 50;
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
      'AWS setup needs prompts. Run interactively once, or keep .company-brain.aws.json.',
    );
  }

  const region = await promptText(
    'AWS region',
    existing?.region ?? 'eu-west-2',
    force,
    nonInteractive,
  );
  const environment = await promptText(
    'Environment name',
    existing?.environment ?? 'dev',
    force,
    nonInteractive,
  );
  const baseDomain = await promptHostname(
    'Base domain for service hostnames',
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

  const selected = await promptIntegrations(existing, force, nonInteractive);
  const oauthValues = await promptProviderCredentials(selected, existing, force, nonInteractive);

  const config: AwsConfig = {
    version: 1,
    terraformCommand: existing?.terraformCommand,
    region,
    environment,
    baseDomain,
    instanceType: await promptText(
      'EC2 instance type',
      existing?.instanceType ?? 't3.large',
      force,
      nonInteractive,
    ),
    rootVolumeSize: await promptNumber(
      'Root volume size in GB',
      existing?.rootVolumeSize ?? DEFAULT_VOLUME_SIZE_GB,
      force,
      nonInteractive,
    ),
    dataVolumeSize: await promptNumber(
      'Persistent data volume size in GB',
      existing?.dataVolumeSize ?? DEFAULT_VOLUME_SIZE_GB,
      force,
      nonInteractive,
    ),
    ssmSecretPrefix: existing?.ssmSecretPrefix ?? `/company-brain/${environment}`,
    nangoHostname: hostnames.nangoHostname,
    nangoConnectHostname: hostnames.nangoConnectHostname,
    brainHostname: hostnames.brainHostname,
    dozzleHostname: hostnames.dozzleHostname,
    acmeEmail: await promptText(
      'ACME certificate email',
      existing?.acmeEmail ?? '',
      force,
      nonInteractive,
    ),
    workspaceDomain: await promptText(
      'Google Workspace domain allowed to sign in',
      existing?.workspaceDomain ?? 'example.com',
      force,
      nonInteractive,
    ),
    googleClientId: await promptText(
      'Brain Google OAuth client ID',
      existing?.googleClientId ?? '',
      force,
      nonInteractive,
    ),
    dozzleUsername: await promptText(
      'Dozzle admin username',
      existing?.dozzleUsername ?? 'admin',
      force,
      nonInteractive,
    ),
    dozzleEmail: await promptText(
      'Dozzle admin email',
      existing?.dozzleEmail ?? '',
      force,
      nonInteractive,
    ),
    dozzleName: await promptText(
      'Dozzle admin display name',
      existing?.dozzleName ?? 'Admin',
      force,
      nonInteractive,
    ),
    agentSyncWebhookSecret: existing?.agentSyncWebhookSecret ?? randomToken(WEBHOOK_SECRET_BYTES),
    selectedIntegrationIds: selected.map((integration) => integration.id),
    scopes: oauthValues.scopes,
    dns: await promptDns(existing, force, nonInteractive),
    outputs: existing?.outputs,
    lastDeployId: existing?.lastDeployId,
    appDeployedAt: existing?.appDeployedAt,
    nangoBootstrappedAt: existing?.nangoBootstrappedAt,
    syncsDeployedAt: existing?.syncsDeployedAt,
    secrets: {
      googleClientSecret: await promptSecret(
        'Brain Google OAuth client secret',
        existing?.secrets.googleClientSecret,
        force,
        nonInteractive,
      ),
      dozzlePassword: await promptSecret(
        'Dozzle admin password',
        existing?.secrets.dozzlePassword,
        force,
        nonInteractive,
      ),
      nangoSecretKey: existing?.secrets.nangoSecretKey,
      oauth: oauthValues.secrets,
    },
  };

  return config;
}

export async function promptHostedNangoKey(
  existing: string | undefined,
  nonInteractive: boolean,
): Promise<string | undefined> {
  if (existing) {
    return existing;
  }

  if (nonInteractive) {
    return undefined;
  }

  const answer = await password({
    message: 'Hosted Nango dev API key',
    validate: validateRequired,
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  return answer || undefined;
}

export async function confirmManualDnsReady(nonInteractive: boolean): Promise<boolean> {
  if (nonInteractive) {
    return false;
  }

  const answer = await confirm({
    message: 'Have you created the DNS records above?',
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
    message: 'Customize service hostnames?',
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
      existing?.nangoHostname ?? derived.nangoHostname,
      force,
      nonInteractive,
    ),
    nangoConnectHostname: await promptHostname(
      'Nango Connect hostname',
      existing?.nangoConnectHostname ?? derived.nangoConnectHostname,
      force,
      nonInteractive,
    ),
    brainHostname: await promptHostname(
      'Brain hostname',
      existing?.brainHostname ?? derived.brainHostname,
      force,
      nonInteractive,
    ),
    dozzleHostname: await promptHostname(
      'Dozzle logs hostname',
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
    message: 'How should the CLI handle DNS records?',
    options: [
      { value: 'manual', label: 'Manual DNS' },
      { value: 'route53', label: 'Route53 hosted zone' },
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
      existing?.dns.hostedZoneId ?? '',
      true,
      nonInteractive,
    ),
  };
}

async function promptIntegrations(
  existing: AwsConfig | undefined,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<IntegrationSpec[]> {
  if (existing && existing.selectedIntegrationIds.length > 0 && !force) {
    const selected = new Set(existing.selectedIntegrationIds);
    return nangoIntegrationSpecs.filter((integration) => selected.has(integration.id));
  }
  if (nonInteractive) {
    throw new Error('Missing selected integrations in .company-brain.aws.json.');
  }

  const answer = await multiselect({
    message: 'Which integrations should the hosted Nango deploy configure?',
    options: nangoIntegrationSpecs.map((integration) => ({
      value: integration.id,
      label: integration.displayName,
      hint: integration.provider,
    })),
    required: true,
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  return nangoIntegrationSpecs.filter((integration) => answer.includes(integration.id));
}

async function promptProviderCredentials(
  selected: IntegrationSpec[],
  existing: AwsConfig | undefined,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<{ secrets: Record<string, string>; scopes: Record<string, string> }> {
  const secrets: Record<string, string> = { ...existing?.secrets.oauth };
  const scopes: Record<string, string> = { ...existing?.scopes };

  for (const integration of selected) {
    if (!integration.oauth) {
      continue;
    }

    secrets[integration.oauth.clientIdEnv] = await promptText(
      `${integration.displayName} client ID`,
      secrets[integration.oauth.clientIdEnv] ?? '',
      force,
      nonInteractive,
    );
    secrets[integration.oauth.clientSecretEnv] = await promptSecret(
      `${integration.displayName} client secret`,
      secrets[integration.oauth.clientSecretEnv],
      force,
      nonInteractive,
    );

    if (integration.oauth.scopesEnv && integration.oauth.scopes) {
      scopes[integration.oauth.scopesEnv] =
        scopes[integration.oauth.scopesEnv] ?? integration.oauth.scopes;
    }
  }

  return { secrets, scopes };
}

async function promptText(
  message: string,
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
    message,
    defaultValue,
    validate: validateRequired,
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  return answer;
}

async function promptHostname(
  message: string,
  defaultValue: string,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<string> {
  return stripProtocol(await promptText(message, defaultValue, force, nonInteractive));
}

async function promptNumber(
  message: string,
  defaultValue: number,
  force: boolean | undefined,
  nonInteractive: boolean | undefined,
): Promise<number> {
  const value = await promptText(message, String(defaultValue), force, nonInteractive);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${message} must be a positive number.`);
  }

  return parsed;
}

async function promptSecret(
  message: string,
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
    message: existing ? `${message} (press Enter to keep existing value)` : message,
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

function validateRequired(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Required';
  }

  return undefined;
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

function stripProtocol(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}
