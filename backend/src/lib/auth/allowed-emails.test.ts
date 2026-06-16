import { describe, expect, it } from 'bun:test';
import { isEmailAllowed, parseAllowedEmails } from './allowed-emails.ts';

describe('parseAllowedEmails', () => {
  it('treats empty or whitespace-only input as unset (null)', () => {
    expect(parseAllowedEmails(undefined)).toBeNull();
    expect(parseAllowedEmails('')).toBeNull();
    expect(parseAllowedEmails('  ,  ')).toBeNull();
  });

  it('splits exact emails and wildcard domains', () => {
    const allowed = parseAllowedEmails('Alice@Example.com, *@onfabric.io');
    expect(allowed).toEqual({
      exact: new Set(['alice@example.com']),
      wildcardDomains: new Set(['onfabric.io']),
    });
  });
});

describe('isEmailAllowed', () => {
  it('allows every email when the allowlist is unset', () => {
    expect(isEmailAllowed(null, 'anyone@anywhere.com')).toBe(true);
  });

  it('matches exact emails case-insensitively', () => {
    const allowed = parseAllowedEmails('alice@example.com');
    expect(isEmailAllowed(allowed, 'ALICE@example.com')).toBe(true);
    expect(isEmailAllowed(allowed, 'bob@example.com')).toBe(false);
  });

  it('matches a whole workspace via wildcard', () => {
    const allowed = parseAllowedEmails('*@onfabric.io');
    expect(isEmailAllowed(allowed, 'massimo@onfabric.io')).toBe(true);
    expect(isEmailAllowed(allowed, 'attacker@evil-onfabric.io')).toBe(false);
    expect(isEmailAllowed(allowed, 'attacker@onfabric.io.evil.com')).toBe(false);
  });
});
