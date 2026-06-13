import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { StatusMap } from 'elysia';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const testEnv = process.env as Record<string, string | undefined>;
testEnv.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
testEnv.BRAIN_API_KEY ??= '00000000-0000-4000-8000-000000000000';
testEnv.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-0000000000000000';
testEnv.GOOGLE_CLIENT_ID ??= 'test-google-client-id';
testEnv.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret';
// Pin the public URL so the JWKS host matches the mock server below. The eager
// `env` singleton freezes these derivations at whichever test file imports it
// first, so the values are read back from `env` rather than re-derived here.
testEnv.BRAIN_PUBLIC_URL ??= 'http://localhost:18851';

const { env } = await import('#lib/env.ts');
const ISSUER = env.issuer;
const RESOURCE = env.mcpResource.href;
const JWKS_PORT = Number(env.jwksUrl.port);
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
  jwksServer = Bun.serve({
    port: JWKS_PORT,
    routes: {
      '/api/auth/jwks': () => Response.json({ keys: [jwk] }),
    },
    fetch: () => new Response('not found', { status: 404 }),
  });

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

  it('serves RFC 8414 authorization server metadata at the issuer', async () => {
    const res = await fetch(new URL('/api/auth/.well-known/oauth-authorization-server', baseUrl));
    expect(res.status).toBe(StatusMap.OK);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const metadata = (await res.json()) as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
      jwks_uri: string;
    };
    expect(metadata.issuer).toBe(ISSUER);
    expect(metadata.authorization_endpoint).toBeString();
    expect(metadata.token_endpoint).toBeString();
    expect(metadata.registration_endpoint).toBeString();
    expect(metadata.jwks_uri).toBeString();
  });
});
