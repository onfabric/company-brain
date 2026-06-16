// The dashboard sign-in allowlist. Each entry is a literal email
// (`alice@example.com`) or a domain wildcard (`*@example.com`). An empty value,
// a bare `*`, a `*@*`, or any other shape is rejected — the allowlist can never
// silently fall open to every account. Matching is case-insensitive.
export type AllowedEmails = {
  exact: ReadonlySet<string>;
  wildcardDomains: ReadonlySet<string>;
};

// A literal `local@domain.tld` or a domain wildcard `*@domain.tld`. A bare `*`,
// `*@*`, or a dotless domain does not match, so a catch-all can't be expressed.
const ENTRY_PATTERN = /^(\*|[^@\s]+)@[^@\s]+\.[^@\s]+$/;

export function parseAllowedEmails(input: string): AllowedEmails {
  const exact = new Set<string>();
  const wildcardDomains = new Set<string>();
  for (const raw of input.split(',')) {
    const entry = raw.trim().toLowerCase();
    if (!entry) {
      continue;
    }
    if (!ENTRY_PATTERN.test(entry)) {
      throw new Error(
        `Invalid ALLOWED_DASHBOARD_ACCOUNTS_EMAILS entry "${entry}": use email@domain or *@domain (a bare "*" is not allowed).`,
      );
    }
    const at = entry.lastIndexOf('@');
    if (entry.slice(0, at) === '*') {
      wildcardDomains.add(entry.slice(at + 1));
    } else {
      exact.add(entry);
    }
  }
  if (exact.size === 0 && wildcardDomains.size === 0) {
    throw new Error(
      'ALLOWED_DASHBOARD_ACCOUNTS_EMAILS must list at least one allowed email or *@domain.',
    );
  }
  return { exact, wildcardDomains };
}

export function isEmailAllowed(allowed: AllowedEmails, email: string): boolean {
  const normalized = email.toLowerCase();
  if (allowed.exact.has(normalized)) {
    return true;
  }
  const at = normalized.lastIndexOf('@');
  return at > 0 && allowed.wildcardDomains.has(normalized.slice(at + 1));
}
