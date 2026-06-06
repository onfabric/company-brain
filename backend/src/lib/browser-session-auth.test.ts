import { describe, expect, it } from 'bun:test';

(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';
(process.env as Record<string, string | undefined>).BRAIN_API_KEY ??=
  '00000000-0000-4000-8000-000000000000';

const {
  BRAIN_SESSION_COOKIE,
  BRAIN_SESSION_TTL_SECONDS,
  createBrainSessionSetCookie,
  createBrainSessionToken,
  hasValidKnowledgePageAuth,
  isSecureCookieRequest,
  isValidBrainSessionToken,
} = await import('#lib/browser-session-auth.ts');

const { API_KEY_HEADER } = await import('#lib/api-key-auth.ts');

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

  it('accepts either the api key header or the session cookie', () => {
    const token = createBrainSessionToken();

    expect(
      hasValidKnowledgePageAuth({ [API_KEY_HEADER]: '00000000-0000-4000-8000-000000000000' }),
    ).toBe(true);
    expect(hasValidKnowledgePageAuth({ cookie: `${BRAIN_SESSION_COOKIE}=${token}` })).toBe(true);
    expect(hasValidKnowledgePageAuth({ cookie: `${BRAIN_SESSION_COOKIE}=invalid` })).toBe(false);
  });

  it('sets the browser session cookie attributes', () => {
    const cookie = createBrainSessionSetCookie({ secure: true });

    expect(cookie).toContain(`${BRAIN_SESSION_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/knowledge/pages');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('detects secure requests from direct and forwarded HTTPS', () => {
    expect(isSecureCookieRequest({}, 'https://brain-dev.onfabric.io/sessions')).toBe(true);
    expect(
      isSecureCookieRequest({ 'x-forwarded-proto': 'https' }, 'http://localhost/sessions'),
    ).toBe(true);
    expect(isSecureCookieRequest({}, 'http://localhost/sessions')).toBe(false);
  });
});
