import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { StatusMap } from 'elysia';

const testEnv = process.env as Record<string, string | undefined>;
testEnv.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
testEnv.BRAIN_API_KEY ??= '00000000-0000-4000-8000-000000000000';
testEnv.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-0000000000000000';
testEnv.GOOGLE_CLIENT_ID ??= 'test-google-client-id';
testEnv.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret';
testEnv.BRAIN_PUBLIC_URL ??= 'http://localhost:18851';

const API_KEY = process.env.BRAIN_API_KEY as string;

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

let app: { stop(): Promise<unknown> };
let mcpUrl: URL;

beforeAll(async () => {
  const { createApp } = await import('#app.ts');
  const listening = createApp().listen(0);
  app = listening;
  mcpUrl = new URL('/mcp', listening.server!.url);
});

afterAll(async () => {
  await app.stop();
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

describe('root controller (mcp mount)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await fetch(initializeRequest({}));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('rejects the brain api key (OAuth-only on /mcp)', async () => {
    const res = await fetch(initializeRequest({ 'api-key': API_KEY }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('delegates GET and DELETE to mcp-use rather than answering 405', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await fetch(mcpUrl, { method });
      expect(res.status).toBe(StatusMap.Unauthorized);
    }
  });

  it('forwards OAuth discovery to mcp-use, not the SPA fallback', async () => {
    const res = await fetch(new URL('/.well-known/oauth-protected-resource', mcpUrl.origin));
    expect(res.status).toBe(StatusMap.OK);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toHaveProperty('resource');
  });

  it('forwards /api/auth/* to better-auth, not the SPA fallback', async () => {
    const res = await fetch(new URL('/api/auth/get-session', mcpUrl.origin), {
      headers: { accept: 'application/json' },
    });
    // better-auth answers (200 with a null/empty session) rather than the SPA
    // shell's "not built" 404 — proving the path reached the mounted auth app.
    expect(res.status).toBe(StatusMap.OK);
  });

  it('falls through unknown paths to the dashboard SPA instead of mcp-use', async () => {
    const res = await fetch(new URL('/some/client-route', mcpUrl.origin));
    // No bundle is built in the backend test run, so the SPA handler reports it
    // is missing — proving the request reached the SPA fallback, not mcp-use.
    expect(res.status).toBe(StatusMap['Not Found']);
    expect(await res.text()).toBe('Dashboard has not been built.');
  });

  it('keeps a real 404 for unknown API paths instead of the SPA shell', async () => {
    for (const path of ['/api/does-not-exist', '/internal/does-not-exist']) {
      const res = await fetch(new URL(path, mcpUrl.origin));
      expect(res.status).toBe(StatusMap['Not Found']);
      // Not the SPA shell — API clients get a 404, never index.html.
      expect(await res.text()).not.toBe('Dashboard has not been built.');
    }
  });
});
