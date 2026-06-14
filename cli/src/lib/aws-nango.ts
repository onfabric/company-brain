import type { AwsConfig } from './aws-config.ts';

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
