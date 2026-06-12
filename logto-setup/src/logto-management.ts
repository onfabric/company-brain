import { MANAGEMENT_API_RESOURCE, requiredEnv, requiredUrlEnv } from './env.ts';

const upstream = requiredUrlEnv('LOGTO_UPSTREAM_URL');
const m2mClientId = requiredEnv('LOGTO_M2M_CLIENT_ID');
const m2mClientSecret = requiredEnv('LOGTO_M2M_CLIENT_SECRET');

const TOKEN_REFRESH_MARGIN_MS = 30_000;
const MILLISECONDS_PER_SECOND = 1_000;

let cached: { token: string; expiresAt: number } | null = null;

export async function managementToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }
  const res = await fetch(new URL('oidc/token', upstream), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${m2mClientId}:${m2mClientSecret}`).toString('base64')}`,
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

export async function managementApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await managementToken();
  const res = await fetch(new URL(`api/${path}`, upstream), {
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
  if (!res.headers.get('content-type')?.includes('application/json')) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export type LogtoResource = { id: string; indicator: string };
export type LogtoScope = { id: string; name: string };
export type LogtoApplication = { id: string; name: string };

export async function findMcpScope(
  mcpResource: string,
  scopeName: string,
): Promise<LogtoScope | null> {
  const resources = await managementApi<LogtoResource[]>('GET', 'resources');
  const resource = resources.find((r) => r.indicator === mcpResource);
  if (!resource) {
    return null;
  }
  const scopes = await managementApi<LogtoScope[]>('GET', `resources/${resource.id}/scopes`);
  return scopes.find((s) => s.name === scopeName) ?? null;
}
