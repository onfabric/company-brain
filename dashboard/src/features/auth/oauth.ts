const DEFAULT_CALLBACK_URL = '/dashboard';
const AUTHORIZE_PATH = '/api/auth/oauth2/authorize';
const PUBLIC_CLIENT_PATH = '/api/auth/oauth2/public-client';
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

export function parseClientId(search: string): string {
  return new URLSearchParams(search).get('client_id') ?? '';
}

export function parseScopes(search: string): string[] {
  const scope = new URLSearchParams(search).get('scope');
  return scope ? scope.split(' ').filter(Boolean) : [];
}

// The consent redirect carries only the client id, so resolve the registered
// display name from better-auth's public-client endpoint; fall back to the id.
export async function fetchClientName(clientId: string): Promise<string> {
  try {
    const response = await fetch(
      `${PUBLIC_CLIENT_PATH}?client_id=${encodeURIComponent(clientId)}`,
      {
        credentials: 'include',
        headers: { accept: 'application/json' },
      },
    );
    if (!response.ok) {
      return clientId;
    }
    const data = (await response.json()) as { client_name?: string };
    return data.client_name ?? clientId;
  } catch {
    return clientId;
  }
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
// redirected with, so accept/deny replay the full query string as `oauth_query`.
export async function submitConsent(accept: boolean, search: string): Promise<string | null> {
  const response = await fetch(CONSENT_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accept, oauth_query: search.replace(/^\?/, '') }),
  });
  const data = (await response.json().catch(() => ({}))) as { url?: string };
  return data.url ?? null;
}
