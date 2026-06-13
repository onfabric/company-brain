import { describe, expect, it } from 'bun:test';

(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';
(process.env as Record<string, string | undefined>).BRAIN_API_KEY ??=
  '00000000-0000-4000-8000-000000000000';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_ID ??= 'test-google-client-id';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_SECRET ??=
  'test-google-client-secret';
(process.env as Record<string, string | undefined>).MCP_RESOURCE ??= 'http://localhost:3010/mcp';
(process.env as Record<string, string | undefined>).BRAIN_PUBLIC_URL ??= 'http://localhost:3010';
(process.env as Record<string, string | undefined>).GOOGLE_TOKEN_ENDPOINT ??=
  'http://localhost:18841/token';
(process.env as Record<string, string | undefined>).GOOGLE_TOKENINFO_ENDPOINT ??=
  'http://localhost:18841/tokeninfo';

const {
  BRAIN_SESSION_TTL_SECONDS,
  createBrainSessionToken,
  isSecureCookieRequest,
  isValidBrainSessionToken,
} = await import('#lib/browser-session-auth.ts');

const MILLISECONDS_PER_SECOND = 1_000;
const SESSION_START = MILLISECONDS_PER_SECOND;

describe('browser session auth', () => {
  it('validates unexpired signed session tokens', () => {
    const token = createBrainSessionToken(SESSION_START);
    expect(isValidBrainSessionToken(token, SESSION_START)).toBe(true);
    expect(
      isValidBrainSessionToken(token, (BRAIN_SESSION_TTL_SECONDS + 2) * MILLISECONDS_PER_SECOND),
    ).toBe(false);
  });

  it('rejects tampered session tokens', () => {
    const [payload] = createBrainSessionToken().split('.');
    expect(isValidBrainSessionToken(`${payload}.forged-signature`)).toBe(false);
  });

  it('detects secure requests from direct and forwarded HTTPS', () => {
    expect(isSecureCookieRequest({}, 'https://brain-dev.onfabric.io/sessions')).toBe(true);
    expect(
      isSecureCookieRequest({ 'x-forwarded-proto': 'https' }, 'http://localhost/sessions'),
    ).toBe(true);
    expect(isSecureCookieRequest({}, 'http://localhost/sessions')).toBe(false);
  });
});
