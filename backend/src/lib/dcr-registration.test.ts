import { describe, expect, it } from 'bun:test';
import { isAllowedRedirectUri } from './dcr-registration.ts';

describe('isAllowedRedirectUri', () => {
  it('accepts https and loopback http uris', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:33418/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:8080/cb')).toBe(true);
  });

  it('rejects remote http and malformed uris', () => {
    expect(isAllowedRedirectUri('http://evil.example.com/cb')).toBe(false);
    expect(isAllowedRedirectUri('not a url')).toBe(false);
    expect(isAllowedRedirectUri('custom-scheme://cb')).toBe(false);
  });
});
