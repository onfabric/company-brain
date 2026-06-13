import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StatusMap } from 'elysia';

const MOCK_GOOGLE_PORT = 18841;
const MOCK_GOOGLE = `http://localhost:${MOCK_GOOGLE_PORT}`;

(process.env as Record<string, string | undefined>).NODE_ENV = 'production';
(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';
(process.env as Record<string, string | undefined>).BRAIN_API_KEY ??=
  '00000000-0000-4000-8000-000000000000';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_ID ??= 'test-google-client-id';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_SECRET ??=
  'test-google-client-secret';
(process.env as Record<string, string | undefined>).BRAIN_PUBLIC_URL ??= 'http://localhost:3010';
(process.env as Record<string, string | undefined>).GOOGLE_WORKSPACE_DOMAIN ??= 'onfabric.io';
(process.env as Record<string, string | undefined>).GOOGLE_TOKEN_ENDPOINT ??=
  `${MOCK_GOOGLE}/token`;
(process.env as Record<string, string | undefined>).GOOGLE_TOKENINFO_ENDPOINT ??=
  `${MOCK_GOOGLE}/tokeninfo`;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const API_KEY = process.env.BRAIN_API_KEY as string;

const MILLISECONDS_PER_SECOND = 1000;
const ONE_HOUR_SECONDS = 3600;
const PKCE_CHALLENGE_LENGTH = 43;
const HTTP_REDIRECT_MIN = 300;
const HTTP_REDIRECT_MAX = 400;
const VALID_TOKEN = 'valid-workspace-token';
const FOREIGN_DOMAIN_TOKEN = 'foreign-domain-token';

function expiresInOneHour(): string {
  return String(Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + ONE_HOUR_SECONDS);
}

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

let googleServer: ReturnType<typeof Bun.serve>;
let app: { stop(): Promise<unknown> };
let baseUrl: URL;
let mcpUrl: URL;

beforeAll(async () => {
  googleServer = Bun.serve({
    port: MOCK_GOOGLE_PORT,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/tokeninfo') {
        const token = url.searchParams.get('access_token');
        if (token === VALID_TOKEN) {
          return Response.json({
            aud: CLIENT_ID,
            sub: '123',
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
        return Response.json({ error: 'invalid_token' });
      }
      return new Response('not found', { status: StatusMap['Not Found'] });
    },
  });

  const { createApp } = await import('#app.ts');
  const listening = createApp().listen(0);
  app = listening;
  baseUrl = new URL(listening.server!.url);
  mcpUrl = new URL('/mcp', baseUrl);
});

afterAll(async () => {
  await app.stop();
  await googleServer.stop();
});

function initializeRequest(headers: Record<string, string>): Request {
  return new Request(mcpUrl.href, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: INITIALIZE_BODY,
  });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('mcp-use oauth proxy metadata', () => {
  it('advertises the brain authorize/token/register endpoints with S256 PKCE', async () => {
    const res = await fetch(new URL('/.well-known/oauth-authorization-server', baseUrl));
    expect(res.status).toBe(StatusMap.OK);
    const body = await readJson(res);
    expect(String(body.authorization_endpoint)).toMatch(/\/authorize$/);
    expect(String(body.token_endpoint)).toMatch(/\/token$/);
    expect(String(body.registration_endpoint)).toMatch(/\/register$/);
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
  });

  it('redirects /authorize to Google with the hd restriction', async () => {
    const url = new URL('/authorize', baseUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', 'https://claude.ai/api/mcp/auth_callback');
    url.searchParams.set('code_challenge', 'x'.repeat(PKCE_CHALLENGE_LENGTH));
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', 'abc');
    const res = await fetch(url, { redirect: 'manual' });
    expect(res.status).toBeGreaterThanOrEqual(HTTP_REDIRECT_MIN);
    expect(res.status).toBeLessThan(HTTP_REDIRECT_MAX);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('accounts.google.com');
    expect(new URL(location).searchParams.get('hd')).toBe('onfabric.io');
  });

  it('serves protected resource metadata', async () => {
    for (const path of [
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/mcp',
    ]) {
      const res = await fetch(new URL(path, baseUrl));
      expect(res.status).toBe(StatusMap.OK);
      const body = await readJson(res);
      expect(Array.isArray(body.authorization_servers)).toBe(true);
      expect(body.bearer_methods_supported).toEqual(['header']);
    }
  });

  it('returns the shared Google client_id from /register', async () => {
    const res = await fetch(new URL('/register', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] }),
    });
    expect(res.status).toBe(StatusMap.Created);
    expect((await readJson(res)).client_id).toBe(CLIENT_ID);
  });
});

describe('mcp-use access control', () => {
  it('challenges unauthenticated requests with a bearer + resource metadata', async () => {
    const res = await fetch(initializeRequest({}));
    expect(res.status).toBe(StatusMap.Unauthorized);
    const challenge = res.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain('Bearer');
    expect(challenge).toContain('resource_metadata=');
  });

  it('accepts a valid workspace Google access token', async () => {
    const res = await fetch(initializeRequest({ authorization: `Bearer ${VALID_TOKEN}` }));
    expect(res.status).toBe(StatusMap.OK);
  });

  it('rejects a token from outside the workspace domain', async () => {
    const res = await fetch(initializeRequest({ authorization: `Bearer ${FOREIGN_DOMAIN_TOKEN}` }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('still accepts the static api key', async () => {
    const res = await fetch(initializeRequest({ 'api-key': API_KEY }));
    expect(res.status).toBe(StatusMap.OK);
  });
});

describe('knowledge tools', () => {
  it('exposes get_index_page and get_page over streamable http', async () => {
    const transport = new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: { headers: { authorization: `Bearer ${VALID_TOKEN}` } },
    });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual(['get_index_page', 'get_page']);
    } finally {
      await client.close();
    }
  });
});
