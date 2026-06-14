export const MAX_AWS_ENVIRONMENT_NAME_LENGTH = 18;

export function normalizeAwsEnvironment(value: string): string {
  return value.trim().toLowerCase();
}

export function validateAwsEnvironment(value: string): string | undefined {
  const normalized = normalizeAwsEnvironment(value);
  if (!normalized) {
    return 'Required';
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    return 'Use lowercase letters, numbers, and hyphens only.';
  }
  if (normalized.length > MAX_AWS_ENVIRONMENT_NAME_LENGTH) {
    return `Use ${MAX_AWS_ENVIRONMENT_NAME_LENGTH} characters or fewer.`;
  }

  return undefined;
}
