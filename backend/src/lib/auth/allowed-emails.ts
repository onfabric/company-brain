// The dashboard sign-in allowlist, parsed once from a comma-separated list of
// entries. Each entry is either a literal email (`alice@example.com`) or a
// whole-workspace wildcard (`*@example.com`). Matching is case-insensitive.
// A null allowlist means "unset" — every account is allowed.
export type AllowedEmails = {
  exact: ReadonlySet<string>;
  wildcardDomains: ReadonlySet<string>;
};

export function parseAllowedEmails(input: string | undefined): AllowedEmails | null {
  if (!input) {
    return null;
  }
  const exact = new Set<string>();
  const wildcardDomains = new Set<string>();
  for (const raw of input.split(',')) {
    const entry = raw.trim().toLowerCase();
    if (!entry) {
      continue;
    }
    const at = entry.lastIndexOf('@');
    if (at > 0 && entry.slice(0, at) === '*') {
      wildcardDomains.add(entry.slice(at + 1));
    } else {
      exact.add(entry);
    }
  }
  if (exact.size === 0 && wildcardDomains.size === 0) {
    return null;
  }
  return { exact, wildcardDomains };
}

export function isEmailAllowed(allowed: AllowedEmails | null, email: string): boolean {
  if (allowed === null) {
    return true;
  }
  const normalized = email.toLowerCase();
  if (allowed.exact.has(normalized)) {
    return true;
  }
  const at = normalized.lastIndexOf('@');
  return at > 0 && allowed.wildcardDomains.has(normalized.slice(at + 1));
}
