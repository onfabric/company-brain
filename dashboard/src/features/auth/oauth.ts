const DEFAULT_CALLBACK_URL = '/';
const AUTHORIZE_PATH = '/api/auth/oauth2/authorize';
const SOCIAL_SIGN_IN_PATH = '/api/auth/sign-in/social';
const CONSENT_PATH = '/api/auth/oauth2/consent';

// better-auth redirects the OAuth `authorize` request to the sign-in page with the
// original request as the query string; replaying that query against `authorize`
// resumes the flow once a session exists. Without those params the page is the
// dashboard's own login and the user returns to the `callbackURL`.
export function resolveSignInTarget(search: string): string {
  const params = new URLSearchParams(search);
  const callbackURL = params.get('callbackURL') ?? undefined;
  params.delete('callbackURL');
  const authorizeQuery = params.toString();
  return authorizeQuery ? `${AUTHORIZE_PATH}?${authorizeQuery}` : safeCallbackURL(callbackURL);
}

// Only same-origin relative paths are allowed so the post-login redirect cannot be
// pointed at an attacker-controlled destination.
function safeCallbackURL(value: string | undefined): string {
  if (value?.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return DEFAULT_CALLBACK_URL;
}

// better-auth answers a browser fetch with `{ url }` (200) rather than a 302, so
// the page follows the returned URL itself.
export async function startGoogleSignIn(callbackURL: string): Promise<string | null> {
  const response = await fetch(SOCIAL_SIGN_IN_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ provider: 'google', callbackURL }),
  });
  const data = (await response.json().catch(() => ({}))) as { url?: string };
  return data.url ?? null;
}

// The consent endpoint verifies the signed authorize request the page was
// redirected with, so the grant replays the full query string as `oauth_query`.
export async function approveConsent(search: string): Promise<string | null> {
  const response = await fetch(CONSENT_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accept: true, oauth_query: search.replace(/^\?/, '') }),
  });
  const data = (await response.json().catch(() => ({}))) as { url?: string };
  return data.url ?? null;
}
