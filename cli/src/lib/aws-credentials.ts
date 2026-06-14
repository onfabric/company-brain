export type AwsCredentialConfig = {
  awsProfile?: string;
  awsCredentials?: AwsCredentials;
};

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: string;
};

export function detectAwsProfile(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return normalizeAwsProfile(env.AWS_PROFILE) ?? normalizeAwsProfile(env.AWS_DEFAULT_PROFILE);
}

export function awsCredentialResolutionEnv(
  config: AwsCredentialConfig = {},
): Record<string, string | undefined> {
  const awsProfile = normalizeAwsProfile(config.awsProfile);
  return {
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_PAGER: '',
    AWS_SDK_LOAD_CONFIG: '1',
    ...(awsProfile
      ? {
          AWS_PROFILE: awsProfile,
          AWS_DEFAULT_PROFILE: awsProfile,
        }
      : {}),
  };
}

export function awsCommandEnv(
  config: AwsCredentialConfig = {},
): Record<string, string | undefined> {
  return awsCredentialResolutionEnv(config);
}

export function awsSdkEnv(config: AwsCredentialConfig = {}): Record<string, string | undefined> {
  if (!config.awsCredentials) {
    return awsCredentialResolutionEnv(config);
  }

  return {
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_PAGER: '',
    AWS_SDK_LOAD_CONFIG: '1',
    AWS_PROFILE: undefined,
    AWS_DEFAULT_PROFILE: undefined,
    AWS_ACCESS_KEY_ID: config.awsCredentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: config.awsCredentials.secretAccessKey,
    AWS_SESSION_TOKEN: config.awsCredentials.sessionToken,
  };
}

export function normalizeAwsProfile(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseAwsCredentialProcessOutput(output: string): AwsCredentials {
  const parsed = JSON.parse(output) as {
    AccessKeyId?: unknown;
    SecretAccessKey?: unknown;
    SessionToken?: unknown;
    Expiration?: unknown;
  };
  if (typeof parsed.AccessKeyId !== 'string' || parsed.AccessKeyId.length === 0) {
    throw new Error('AWS CLI credential export returned no access key.');
  }
  if (typeof parsed.SecretAccessKey !== 'string' || parsed.SecretAccessKey.length === 0) {
    throw new Error('AWS CLI credential export returned no secret key.');
  }

  return {
    accessKeyId: parsed.AccessKeyId,
    secretAccessKey: parsed.SecretAccessKey,
    sessionToken: optionalString(parsed.SessionToken),
    expiration: optionalString(parsed.Expiration),
  };
}

export function withAwsCredentials<T extends AwsCredentialConfig>(
  config: T,
  credentials: AwsCredentialConfig,
): T & AwsCredentialConfig {
  return {
    ...config,
    awsProfile: credentials.awsProfile ?? config.awsProfile,
    awsCredentials: credentials.awsCredentials,
  };
}

export function hasExportedAwsCredentials(config: AwsCredentialConfig): boolean {
  return Boolean(config.awsCredentials?.accessKeyId && config.awsCredentials.secretAccessKey);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
