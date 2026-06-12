import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { StatusMap } from 'elysia';

(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';
(process.env as Record<string, string | undefined>).BRAIN_API_KEY ??=
  '00000000-0000-4000-8000-000000000000';
(process.env as Record<string, string | undefined>).MCP_OAUTH_ISSUER ??=
  'http://localhost:18831/oidc';
(process.env as Record<string, string | undefined>).MCP_OAUTH_JWKS_URL ??=
  'http://localhost:18831/oidc/jwks';
(process.env as Record<string, string | undefined>).MCP_RESOURCE ??= 'http://localhost:3010/mcp';
(process.env as Record<string, string | undefined>).LOGTO_UPSTREAM_URL ??= 'http://localhost:18832';
(process.env as Record<string, string | undefined>).LOGTO_M2M_CLIENT_ID ??= 'test-m2m';
(process.env as Record<string, string | undefined>).LOGTO_M2M_CLIENT_SECRET ??= 'test-m2m-secret';

const MOCK_LOGTO_PORT = 18832;
const ISSUER = process.env.MCP_OAUTH_ISSUER as string;
const RESOURCE = process.env.MCP_RESOURCE as string;

// Mock of Logto's surface used by the DCR bridge: token endpoint, discovery
// document, and the Management API endpoints the service calls.
function mockLogto(req: Request): Response {
  const { pathname } = new URL(req.url);
  switch (pathname) {
    case '/oidc/token':
      return Response.json({ access_token: 'test-token', expires_in: 3600 });
    case '/oidc/.well-known/openid-configuration':
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
      });
    case '/api/resources':
      return Response.json([{ id: 'resource-1', indicator: RESOURCE }]);
    case '/api/resources/resource-1/scopes':
      return Response.json([{ id: 'scope-1', name: 'mcp' }]);
    case '/api/applications':
      return Response.json({ id: 'registered-app-1' });
    case '/api/applications/registered-app-1/user-consent-scopes':
      return new Response('Created', { status: 201 });
    default:
      return new Response('unexpected path', { status: 404 });
  }
}

let upstream: ReturnType<typeof Bun.serve>;
let app: { stop(): Promise<unknown> };
let baseUrl: URL;

beforeAll(async () => {
  upstream = Bun.serve({ port: MOCK_LOGTO_PORT, fetch: mockLogto });
  const { createApp } = await import('#app.ts');
  const listening = createApp().listen(0);
  app = listening;
  baseUrl = new URL(listening.server!.url);
});

afterAll(async () => {
  await app.stop();
  await upstream.stop();
});

function register(body: unknown): Promise<Response> {
  return fetch(new URL('/oidc/register', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('oidc register controller', () => {
  it('registers a public client and returns the RFC 7591 response', async () => {
    const res = await register({
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(res.status).toBe(StatusMap.Created);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({
      client_id: 'registered-app-1',
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  });

  it('rejects non-loopback http redirect uris', async () => {
    const res = await register({ redirect_uris: ['http://evil.example.com/cb'] });
    expect(res.status).toBe(StatusMap['Bad Request']);
    expect(await res.json()).toHaveProperty('error', 'invalid_redirect_uri');
  });

  it('rejects requests without redirect uris', async () => {
    const res = await register({ client_name: 'no uris' });
    expect(res.status).toBe(StatusMap['Bad Request']);
  });

  it('advertises the registration endpoint in the discovery document', async () => {
    const res = await fetch(new URL('/oidc/.well-known/openid-configuration', baseUrl));
    expect(res.status).toBe(StatusMap.OK);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const metadata = (await res.json()) as Record<string, unknown>;
    expect(metadata.issuer).toBe(ISSUER);
    expect(metadata.registration_endpoint).toBe(`${ISSUER}/register`);
  });
});
