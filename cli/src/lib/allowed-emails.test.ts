import { describe, expect, it } from 'bun:test';
import { normalizeAllowedEmails, validateAllowedEmailsInput } from './allowed-emails.ts';

describe('normalizeAllowedEmails', () => {
  it('returns undefined for empty input', () => {
    expect(normalizeAllowedEmails('')).toBeUndefined();
    expect(normalizeAllowedEmails('  ,  ')).toBeUndefined();
  });

  it('trims, lowercases, and joins entries into a canonical list', () => {
    expect(normalizeAllowedEmails(' Alice@Gmail.com , *@Example.com ')).toBe(
      'alice@gmail.com,*@example.com',
    );
  });

  it('de-duplicates repeated entries', () => {
    expect(normalizeAllowedEmails('alice@example.com, ALICE@example.com')).toBe(
      'alice@example.com',
    );
  });
});

describe('validateAllowedEmailsInput', () => {
  it('rejects empty input — sign-in must not be left open', () => {
    expect(validateAllowedEmailsInput('')).toBeString();
    expect(validateAllowedEmailsInput(undefined)).toBeString();
  });

  it('accepts emails and wildcard domains', () => {
    expect(validateAllowedEmailsInput('alice@example.com, *@example.com')).toBeUndefined();
  });

  it('rejects entries that are not an email or wildcard domain', () => {
    expect(validateAllowedEmailsInput('not-an-email')).toContain('not-an-email');
    expect(validateAllowedEmailsInput('alice@localhost')).toContain('alice@localhost');
    expect(validateAllowedEmailsInput('*')).toContain('*');
  });
});
