import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { StatusMap } from 'elysia';

// Fixed port: the eager `env` singleton freezes these URLs at first import.
const MOCK_GOOGLE_PORT = 18841;
const MOCK_GOOGLE = `http://localhost:${MOCK_GOOGLE_PORT}`;

(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';
(process.env as Record<string, string | undefined>).BRAIN_API_KEY ??=
  '00000000-0000-4000-8000-000000000000';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_ID ??= 'test-google-client-id';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_SECRET ??=
  'test-google-client-secret';
(process.env as Record<string, string | undefined>).MCP_RESOURCE ??= 'http://localhost:3010/mcp';
(process.env as Record<string, string | undefined>).BRAIN_PUBLIC_URL ??= 'http://localhost:3010';
(process.env as Record<string, string | undefined>).GOOGLE_WORKSPACE_DOMAIN ??= 'onfabric.io';
(process.env as Record<string, string | undefined>).GOOGLE_TOKEN_ENDPOINT ??=
  `${MOCK_GOOGLE}/token`;
(process.env as Record<string, string | undefined>).GOOGLE_TOKENINFO_ENDPOINT ??=
  `${MOCK_GOOGLE}/tokeninfo`;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET as string;
const RESOURCE = process.env.MCP_RESOURCE as string;
const BRAIN_ORIGIN = new URL(process.env.BRAIN_PUBLIC_URL as string).origin;

const VALID_TOKEN = 'valid-workspace-token';
const FOREIGN_DOMAIN_TOKEN = 'foreign-domain-token';
const FOREIGN_CLIENT_TOKEN = 'foreign-client-token';

const MILLISECONDS_PER_SECOND = 1000;
const ONE_HOUR_SECONDS = 3600;

function expiresInOneHour(): string {
  return String(Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + ONE_HOUR_SECONDS);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

type ReceivedTokenRequest = { body: Record<string, string> };
let lastTokenRequest: ReceivedTokenRequest | null = null;

let googleServer: ReturnType<typeof Bun.serve>;
let app: { stop(): Promise<unknown> };
let baseUrl: URL;

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

beforeAll(async () => {
  googleServer = Bun.serve({
    port: MOCK_GOOGLE_PORT,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/tokeninfo') {
        const token = url.searchParams.get('access_token');
        if (token === VALID_TOKEN) {
          return Response.json({
            aud: CLIENT_ID,
            email: 'dev@onfabric.io',
            hd: 'onfabric.io',
            exp: expiresInOneHour(),
          });
        }
        if (token === FOREIGN_DOMAIN_TOKEN) {
          return Response.json({
            aud: CLIENT_ID,
            email: 'someone@gmail.com',
            exp: expiresInOneHour(),
          });
        }
        if (token === FOREIGN_CLIENT_TOKEN) {
          return Response.json({
            aud: 'some-other-client',
            email: 'dev@onfabric.io',
            hd: 'onfabric.io',
            exp: expiresInOneHour(),
          });
        }
        return Response.json({ error: 'invalid_token' }, { status: StatusMap.OK });
      }
      if (url.pathname === '/token') {
        const form = new URLSearchParams(await req.text());
        lastTokenRequest = { body: Object.fromEntries(form) };
        return Response.json({
          access_token: VALID_TOKEN,
          token_type: 'Bearer',
          expires_in: ONE_HOUR_SECONDS,
          refresh_token: 'a-refresh-token',
        });
      }
      return new Response('not found', { status: StatusMap['Not Found'] });
    },
  });

  const { createApp } = await import('#app.ts');
  const listening = createApp().listen(0);
  app = listening;
  baseUrl = new URL(listening.server!.url);
});

afterAll(async () => {
  await app.stop();
  await googleServer.stop();
});

beforeEach(() => {
  lastTokenRequest = null;
});

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

describe('authorization server metadata', () => {
  for (const path of [
    '/.well-known/oauth-authorization-server',
    '/.well-known/openid-configuration',
  ]) {
    it(`advertises Google authorize + brain token/register at ${path}`, async () => {
      const res = await fetch(new URL(path, baseUrl));
      expect(res.status).toBe(StatusMap.OK);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      const body = await readJson(res);
      expect(body.issuer).toBe(BRAIN_ORIGIN);
      expect(body.authorization_endpoint).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(body.token_endpoint).toBe(`${BRAIN_ORIGIN}/token`);
      expect(body.registration_endpoint).toBe(`${BRAIN_ORIGIN}/oidc/register`);
      expect(body.jwks_uri).toBe('https://www.googleapis.com/oauth2/v3/certs');
      expect(body.code_challenge_methods_supported).toEqual(['S256']);
    });
  }
});

describe('protected resource metadata', () => {
  for (const path of [
    '/.well-known/oauth-protected-resource/mcp',
    '/.well-known/oauth-protected-resource',
  ]) {
    it(`points authorization_servers at the brain at ${path}`, async () => {
      const res = await fetch(new URL(path, baseUrl));
      expect(res.status).toBe(StatusMap.OK);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(await res.json()).toEqual({
        resource: RESOURCE,
        authorization_servers: [BRAIN_ORIGIN],
        scopes_supported: ['mcp'],
        bearer_methods_supported: ['header'],
      });
    });
  }
});

describe('dynamic client registration', () => {
  it('returns the shared Google client_id to every client', async () => {
    const res = await fetch(new URL('/oidc/register', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] }),
    });
    expect(res.status).toBe(StatusMap.Created);
    const body = await readJson(res);
    expect(body.client_id).toBe(CLIENT_ID);
    expect(body.token_endpoint_auth_method).toBe('none');
    expect(body.redirect_uris).toEqual(['https://claude.ai/api/mcp/auth_callback']);
  });

  it('rejects non-https, non-loopback redirect URIs', async () => {
    const res = await fetch(new URL('/oidc/register', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['http://evil.example.com/cb'] }),
    });
    expect(res.status).toBe(StatusMap['Bad Request']);
    expect((await readJson(res)).error).toBe('invalid_redirect_uri');
  });
});

describe('token proxy', () => {
  it('injects the Google client_id/secret and forwards the grant', async () => {
    const res = await fetch(new URL('/token', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'an-auth-code',
        code_verifier: 'a-pkce-verifier',
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      }),
    });
    expect(res.status).toBe(StatusMap.OK);
    expect((await readJson(res)).access_token).toBe(VALID_TOKEN);
    expect(lastTokenRequest?.body).toMatchObject({
      grant_type: 'authorization_code',
      code: 'an-auth-code',
      code_verifier: 'a-pkce-verifier',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
  });
});

describe('mcp access control', () => {
  it('challenges unauthenticated requests with the resource metadata URL', async () => {
    const res = await fetch(initializeRequest({}));
    expect(res.status).toBe(StatusMap.Unauthorized);
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${new URL(RESOURCE).origin}/.well-known/oauth-protected-resource/mcp", scope="mcp"`,
    );
  });

  it('accepts a valid workspace Google access token', async () => {
    const res = await fetch(initializeRequest({ authorization: `Bearer ${VALID_TOKEN}` }));
    expect(res.status).toBe(StatusMap.OK);
  });

  it('rejects a token from outside the workspace domain', async () => {
    const res = await fetch(initializeRequest({ authorization: `Bearer ${FOREIGN_DOMAIN_TOKEN}` }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('rejects a token minted for another OAuth client', async () => {
    const res = await fetch(initializeRequest({ authorization: `Bearer ${FOREIGN_CLIENT_TOKEN}` }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('rejects an unknown opaque token', async () => {
    const res = await fetch(initializeRequest({ authorization: 'Bearer nope' }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('still accepts the static api key', async () => {
    const res = await fetch(initializeRequest({ 'api-key': process.env.BRAIN_API_KEY as string }));
    expect(res.status).toBe(StatusMap.OK);
  });
});
