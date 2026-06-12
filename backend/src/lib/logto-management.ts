import { env } from '#lib/env.ts';

// Minimal client for Logto's Management API, authenticated with the M2M
// credentials seeded by logto-setup.

const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';
const TOKEN_REFRESH_MARGIN_MS = 30_000;
const MILLISECONDS_PER_SECOND = 1_000;

let cached: { token: string; expiresAt: number } | null = null;

async function managementToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }
  const credentials = `${env.logtoM2mClientId}:${env.logtoM2mClientSecret}`;
  const res = await fetch(`${env.logtoUpstreamUrl}/oidc/token`, {
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
  const res = await fetch(`${env.logtoUpstreamUrl}/api/${path}`, {
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
