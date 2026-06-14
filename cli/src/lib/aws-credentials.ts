export type AwsCredentialConfig = {
  awsProfile?: string;
};

export function detectAwsProfile(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return normalizeAwsProfile(env.AWS_PROFILE) ?? normalizeAwsProfile(env.AWS_DEFAULT_PROFILE);
}

export function awsCommandEnv(config: AwsCredentialConfig = {}): Record<string, string> {
  const awsProfile = normalizeAwsProfile(config.awsProfile);
  return {
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_SDK_LOAD_CONFIG: '1',
    ...(awsProfile
      ? {
          AWS_PROFILE: awsProfile,
          AWS_DEFAULT_PROFILE: awsProfile,
        }
      : {}),
  };
}

export function normalizeAwsProfile(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
