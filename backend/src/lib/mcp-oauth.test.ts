import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { StatusMap } from 'elysia';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

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

// Fixed port matching every test file's MCP_OAUTH_JWKS_URL default: the eager
// `env` singleton freezes the URL at first import, whichever file that is.
const MOCK_JWKS_PORT = 18831;
const ISSUER = process.env.MCP_OAUTH_ISSUER as string;
const RESOURCE = process.env.MCP_RESOURCE as string;
const KID = 'test-key';

const INITIALIZE_BODY = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '0.0.0' },
  },
});

let privateKey: CryptoKey;
let jwksServer: ReturnType<typeof Bun.serve>;
let app: { stop(): Promise<unknown> };
let baseUrl: URL;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  jwksServer = Bun.serve({ port: MOCK_JWKS_PORT, fetch: () => Response.json({ keys: [jwk] }) });

  const { createApp } = await import('#app.ts');
  const listening = createApp().listen(0);
  app = listening;
  baseUrl = new URL(listening.server!.url);
});

afterAll(async () => {
  await app.stop();
  await jwksServer.stop();
});

function signToken(claims: { issuer?: string; audience?: string } = {}): Promise<string> {
  return new SignJWT({ scope: 'mcp' })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(claims.issuer ?? ISSUER)
    .setAudience(claims.audience ?? RESOURCE)
    .setSubject('dev')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

function initializeRequest(headers: Record<string, string>): Request {
  return new Request(new URL('/mcp', baseUrl).href, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: INITIALIZE_BODY,
  });
}

describe('mcp oauth', () => {
  it('challenges unauthenticated requests with the resource metadata URL', async () => {
    const res = await fetch(initializeRequest({}));
    expect(res.status).toBe(StatusMap.Unauthorized);
    const resourceOrigin = new URL(RESOURCE).origin;
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${resourceOrigin}/.well-known/oauth-protected-resource/mcp", scope="mcp"`,
    );
  });

  it('accepts a valid access token', async () => {
    const token = await signToken();
    const res = await fetch(initializeRequest({ authorization: `Bearer ${token}` }));
    expect(res.status).toBe(StatusMap.OK);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await signToken({ audience: 'https://other.example.com' });
    const res = await fetch(initializeRequest({ authorization: `Bearer ${token}` }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('rejects a token from the wrong issuer', async () => {
    const token = await signToken({ issuer: 'https://evil.example.com' });
    const res = await fetch(initializeRequest({ authorization: `Bearer ${token}` }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('still accepts the static api key', async () => {
    const res = await fetch(initializeRequest({ 'api-key': process.env.BRAIN_API_KEY as string }));
    expect(res.status).toBe(StatusMap.OK);
  });

  it('serves protected resource metadata with CORS at both well-known paths', async () => {
    for (const path of [
      '/.well-known/oauth-protected-resource/mcp',
      '/.well-known/oauth-protected-resource',
    ]) {
      const res = await fetch(new URL(path, baseUrl));
      expect(res.status).toBe(StatusMap.OK);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(await res.json()).toEqual({
        resource: RESOURCE,
        authorization_servers: [ISSUER],
        scopes_supported: ['mcp'],
        bearer_methods_supported: ['header'],
      });
    }
  });
});
