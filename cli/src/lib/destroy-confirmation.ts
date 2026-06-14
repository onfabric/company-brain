import { isCancel, text } from '@clack/prompts';

export async function confirmDestructiveAction({
  expected,
  label,
  nonInteractive,
}: {
  expected: string;
  label: string;
  nonInteractive?: boolean;
}): Promise<void> {
  if (nonInteractive) {
    throw new Error(`${label} destroy must be run interactively.`);
  }

  const answer = await text({
    message: `Type ${expected} to permanently destroy ${label}`,
    validate: (value) => (value === expected ? undefined : 'The phrase does not match.'),
  });

  if (isCancel(answer)) {
    throw new Error('Destroy cancelled.');
  }

  if (answer !== expected) {
    throw new Error('Destroy cancelled.');
  }
}

export function localDestroyPhrase(): string {
  return 'destroy-local';
}

export function awsDestroyPhrase(environment: string, accountId: string): string {
  return `destroy-${environment}-${accountId}`;
}
