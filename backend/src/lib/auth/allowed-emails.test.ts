import { describe, expect, it } from 'bun:test';
import { isEmailAllowed, parseAllowedEmails } from './allowed-emails.ts';

describe('parseAllowedEmails', () => {
  it('rejects an empty or whitespace-only allowlist', () => {
    expect(() => parseAllowedEmails('')).toThrow();
    expect(() => parseAllowedEmails('  ,  ')).toThrow();
  });

  it('rejects a generic wildcard that would match every account', () => {
    expect(() => parseAllowedEmails('*')).toThrow();
    expect(() => parseAllowedEmails('*@*')).toThrow();
    expect(() => parseAllowedEmails('alice@example.com, *')).toThrow();
  });

  it('splits exact emails and domain wildcards', () => {
    const allowed = parseAllowedEmails('Alice@Example.com, *@onfabric.io');
    expect(allowed).toEqual({
      exact: new Set(['alice@example.com']),
      wildcardDomains: new Set(['onfabric.io']),
    });
  });
});

describe('isEmailAllowed', () => {
  it('matches exact emails case-insensitively', () => {
    const allowed = parseAllowedEmails('alice@example.com');
    expect(isEmailAllowed(allowed, 'ALICE@example.com')).toBe(true);
    expect(isEmailAllowed(allowed, 'bob@example.com')).toBe(false);
  });

  it('matches a whole workspace via a domain wildcard', () => {
    const allowed = parseAllowedEmails('*@onfabric.io');
    expect(isEmailAllowed(allowed, 'massimo@onfabric.io')).toBe(true);
    expect(isEmailAllowed(allowed, 'attacker@evil-onfabric.io')).toBe(false);
    expect(isEmailAllowed(allowed, 'attacker@onfabric.io.evil.com')).toBe(false);
  });
});
