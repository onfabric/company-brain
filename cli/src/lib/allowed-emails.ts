export const ALLOWED_EMAILS_PLACEHOLDER = 'alice@example.com, *@example.com';

export function allowedEmailsToRegex(input: string): string | undefined {
  const fragments = splitEntries(input).map(entryToFragment);
  if (fragments.length === 0) {
    return undefined;
  }

  const body = fragments.length === 1 ? fragments[0] : `(${fragments.join('|')})`;
  return `^${body}$`;
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

function entryToFragment(entry: string): string {
  const at = entry.lastIndexOf('@');
  if (at === -1) {
    return escapeRegex(entry);
  }

  const local = entry.slice(0, at);
  const domain = entry.slice(at + 1);
  const localPattern = local === '*' ? '.*' : escapeRegex(local);
  return `${localPattern}@${escapeRegex(domain)}`;
}

function isValidEntry(entry: string): boolean {
  return /^(\*|[^@\s]+)@[^@\s]+\.[^@\s]+$/.test(entry);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
