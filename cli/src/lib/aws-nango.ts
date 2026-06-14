import type { AwsConfig } from './aws-config.ts';
import { hostedNangoEnv } from './aws-config.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

const FETCH_TIMEOUT_MS = 10_000;
const NOT_FOUND_STATUS = 404;

export async function verifyHostedNangoApi(config: AwsConfig): Promise<void> {
  const key = config.secrets.nangoSecretKey;
  if (!key) {
    throw new Error('Missing hosted Nango dev API key.');
  }

  const response = await fetch(
    `https://${config.nangoHostname}/integrations/__company_brain_key_check__?include=credentials`,
    {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!response.ok && response.status !== NOT_FOUND_STATUS) {
    throw new Error(`Hosted Nango API key check failed with HTTP ${response.status}.`);
  }
}

export async function bootstrapHostedNango(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  await runVisible(
    [
      'bun',
      'run',
      'company-brain',
      '--non-interactive',
      '--verbose',
      'nango',
      'integrations',
      '--hosted',
      ...selectedArgs(config),
    ],
    context,
    {
      env: hostedNangoEnv(config),
      approve: true,
      purpose: 'Create or update selected hosted Nango integrations.',
    },
  );
}

export async function deployHostedNangoSyncs(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  await runVisible(
    [
      'bun',
      'run',
      'company-brain',
      '--non-interactive',
      '--verbose',
      'nango',
      'syncs',
      '--hosted',
      ...selectedArgs(config),
    ],
    context,
    {
      env: hostedNangoEnv(config),
      approve: true,
      purpose: 'Check hosted Nango connections and deploy selected syncs.',
    },
  );
}

function selectedArgs(config: AwsConfig): string[] {
  return config.selectedIntegrationIds.length > 0
    ? ['--only', config.selectedIntegrationIds.join(',')]
    : [];
}
