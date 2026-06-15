import { isCancel, note, password } from '@clack/prompts';
import type { AwsConfig } from './aws-config.ts';
import { writeAwsConfig } from './aws-config.ts';
import { readNangoEnv, upsertNangoEnv } from './nango-env.ts';

type Printer = {
  success: (message: string) => void;
  warn: (message: string) => void;
};

export async function ensureLocalNangoApiKey(
  nonInteractive: boolean,
  print: Printer,
): Promise<string | undefined> {
  const env = await readNangoEnv();
  if (env.NANGO_SECRET_KEY_DEV) {
    print.success('Local Nango dev API key is configured.');
    return env.NANGO_SECRET_KEY_DEV;
  }

  if (nonInteractive) {
    print.warn('Local Nango dev API key is missing.');
    note(
      [
        'Open http://localhost:3003/dev/environment-settings#api-keys and copy the dev API key.',
        'Then run: company-brain resume --target local',
      ].join('\n'),
      'Nango API key',
    );
    return undefined;
  }

  const key = await promptNangoApiKey('Local Nango dev API key');
  await upsertNangoEnv({ NANGO_SECRET_KEY_DEV: key });
  print.success('Local Nango dev API key is saved.');
  return key;
}

export async function ensureCloudNangoApiKey(
  config: AwsConfig,
  nonInteractive: boolean,
  print: Printer,
): Promise<AwsConfig> {
  if (config.secrets.nangoSecretKey) {
    print.success('Cloud Nango dev API key is configured.');
    return config;
  }

  if (nonInteractive) {
    print.warn('Cloud Nango dev API key is missing.');
    note(
      [
        `Open https://${config.nangoHostname}/dev/environment-settings#api-keys and copy the dev API key.`,
        'Then run: company-brain resume --target cloud',
      ].join('\n'),
      'Nango API key',
    );
    return config;
  }

  const key = await promptNangoApiKey('Cloud Nango dev API key');
  const updated = {
    ...config,
    secrets: {
      ...config.secrets,
      nangoSecretKey: key,
    },
  };
  await writeAwsConfig(updated);
  print.success('Cloud Nango dev API key is saved.');
  return updated;
}

async function promptNangoApiKey(label: string): Promise<string> {
  const answer = await password({
    message: label,
    validate: (value) => (value?.trim() ? undefined : 'Required'),
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  const value = answer.trim();
  if (!value) {
    throw new Error(`Missing required Nango setting: ${label}`);
  }

  return value;
}
