import { describe, expect, it } from 'vitest';
import { resolveSignInTarget } from '../src/features/auth/oauth.ts';

describe('resolveSignInTarget', () => {
  it('sends the user back to the requested path after login', () => {
    expect(resolveSignInTarget('?callbackURL=%2Frecords%3Ftab%3Dpeople')).toBe(
      '/records?tab=people',
    );
  });

  it('ignores an off-site callback and falls back to the root', () => {
    expect(resolveSignInTarget('?callbackURL=https%3A%2F%2Fevil.example')).toBe('/');
  });

  it('rejects a protocol-relative callback', () => {
    expect(resolveSignInTarget('?callbackURL=%2F%2Fevil.example')).toBe('/');
  });

  it('replays the authorize query when present, dropping callbackURL', () => {
    expect(resolveSignInTarget('?client_id=abc&scope=mcp&callbackURL=%2F')).toBe(
      '/api/auth/oauth2/authorize?client_id=abc&scope=mcp',
    );
  });
});
