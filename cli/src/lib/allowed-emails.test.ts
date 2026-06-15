import { describe, expect, it } from 'bun:test';
import { allowedEmailsToRegex, validateAllowedEmailsInput } from './allowed-emails.ts';

describe('allowedEmailsToRegex', () => {
  it('returns undefined for empty input', () => {
    expect(allowedEmailsToRegex('')).toBeUndefined();
    expect(allowedEmailsToRegex('  ,  ')).toBeUndefined();
  });

  it('builds an anchored alternation for a fixed set across domains', () => {
    expect(allowedEmailsToRegex('alice@gmail.com, bob@outlook.com')).toBe(
      '^(alice@gmail\\.com|bob@outlook\\.com)$',
    );
  });

  it('expands a wildcard local part to any user at the domain', () => {
    expect(allowedEmailsToRegex('*@example.com')).toBe('^.*@example\\.com$');
  });

  it('lowercases and escapes regex metacharacters', () => {
    expect(allowedEmailsToRegex('Alice+Tag@Example.com')).toBe('^alice\\+tag@example\\.com$');
  });

  it('matches the emails it was built from and rejects look-alikes', () => {
    const regex = new RegExp(allowedEmailsToRegex('*@example.com') as string);
    expect(regex.test('anyone@example.com')).toBe(true);
    expect(regex.test('anyone@example.com.evil.com')).toBe(false);
    expect(regex.test('anyone@notexample.com')).toBe(false);
  });
});

describe('validateAllowedEmailsInput', () => {
  it('accepts empty input (allow any)', () => {
    expect(validateAllowedEmailsInput('')).toBeUndefined();
    expect(validateAllowedEmailsInput(undefined)).toBeUndefined();
  });

  it('accepts emails and wildcard domains', () => {
    expect(validateAllowedEmailsInput('alice@example.com, *@example.com')).toBeUndefined();
  });

  it('rejects entries that are not an email or wildcard domain', () => {
    expect(validateAllowedEmailsInput('not-an-email')).toContain('not-an-email');
    expect(validateAllowedEmailsInput('alice@localhost')).toContain('alice@localhost');
  });
});
