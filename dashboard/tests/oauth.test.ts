import { describe, expect, it } from 'vitest';
import { resolveSignInTarget } from '../src/features/auth/oauth.ts';

describe('resolveSignInTarget', () => {
  it('sends the user back to the requested dashboard path after login', () => {
    expect(resolveSignInTarget('?callbackURL=%2Fdashboard%3Ftab%3Dpeople')).toBe(
      '/dashboard?tab=people',
    );
  });

  it('ignores an off-site callback and falls back to the dashboard', () => {
    expect(resolveSignInTarget('?callbackURL=https%3A%2F%2Fevil.example')).toBe('/dashboard');
  });

  it('rejects a protocol-relative callback', () => {
    expect(resolveSignInTarget('?callbackURL=%2F%2Fevil.example')).toBe('/dashboard');
  });

  it('replays the authorize query when present, dropping callbackURL', () => {
    expect(resolveSignInTarget('?client_id=abc&scope=mcp&callbackURL=%2Fdashboard')).toBe(
      '/api/auth/oauth2/authorize?client_id=abc&scope=mcp',
    );
  });
});
