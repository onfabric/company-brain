import { env } from '#lib/env.ts';

// Minimal client for Logto's Management API, authenticated with the M2M
// credentials seeded by logto-setup.

// Fixed resource indicator (token audience) of Logto's built-in Management
// API for the OSS `default` tenant — an identifier, never fetched as a URL.
const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';
const TOKEN_REFRESH_MARGIN_MS = 30_000;
const MILLISECONDS_PER_SECOND = 1_000;

let cached: { token: string; expiresAt: number } | null = null;

async function managementToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }
  if (!env.logtoM2mCredentials) {
    throw new Error('Logto Management API credentials are not configured');
  }
  const { clientId, clientSecret } = env.logtoM2mCredentials;
  const credentials = `${clientId}:${clientSecret}`;
  const res = await fetch(new URL('oidc/token', env.logtoUpstreamUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource: MANAGEMENT_API_RESOURCE,
      scope: 'all',
    }),
  });
  if (!res.ok) {
    throw new Error(`management token request failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * MILLISECONDS_PER_SECOND,
  };
  return body.access_token;
}

export async function logtoManagementApi<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await managementToken();
  const res = await fetch(new URL(`api/${path}`, env.logtoUpstreamUrl), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} /api/${path} failed (${res.status}): ${await res.text()}`);
  }
  // Some endpoints (e.g. user-consent-scopes) reply with plain-text "Created".
  if (!res.headers.get('content-type')?.includes('application/json')) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
