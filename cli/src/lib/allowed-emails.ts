export const ALLOWED_EMAILS_PLACEHOLDER = 'alice@example.com, *@example.com';

// Normalizes operator input into the canonical comma-separated allowlist the
// brain parses at runtime: trimmed, lower-cased, de-duplicated, empty dropped.
export function normalizeAllowedEmails(input: string): string | undefined {
  const entries = [...new Set(splitEntries(input))];
  return entries.length === 0 ? undefined : entries.join(',');
}

export function validateAllowedEmailsInput(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  for (const entry of splitEntries(value)) {
    if (!isValidEntry(entry)) {
      return `Invalid entry "${entry}". Use email@domain or *@domain, comma-separated.`;
    }
  }

  return undefined;
}

function splitEntries(input: string): string[] {
  return input
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function isValidEntry(entry: string): boolean {
  return /^(\*|[^@\s]+)@[^@\s]+\.[^@\s]+$/.test(entry);
}
