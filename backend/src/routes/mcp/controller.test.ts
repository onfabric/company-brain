import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StatusMap } from 'elysia';

(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';
(process.env as Record<string, string | undefined>).BRAIN_API_KEY ??=
  '00000000-0000-4000-8000-000000000000';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_ID ??= 'test-google-client-id';
(process.env as Record<string, string | undefined>).GOOGLE_CLIENT_SECRET ??=
  'test-google-client-secret';
(process.env as Record<string, string | undefined>).MCP_RESOURCE ??= 'http://localhost:3010/mcp';
(process.env as Record<string, string | undefined>).BRAIN_PUBLIC_URL ??= 'http://localhost:3010';
(process.env as Record<string, string | undefined>).GOOGLE_TOKEN_ENDPOINT ??=
  'http://localhost:18841/token';
(process.env as Record<string, string | undefined>).GOOGLE_TOKENINFO_ENDPOINT ??=
  'http://localhost:18841/tokeninfo';

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

describe('mcp controller', () => {
  it('rejects requests without an api key', async () => {
    const res = await fetch(initializeRequest({}));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('rejects requests with a wrong api key', async () => {
    const res = await fetch(initializeRequest({ 'api-key': 'not-the-key' }));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('serves the MCP handshake and tool listing over streamable http', async () => {
    const transport = new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: { headers: { 'api-key': API_KEY } },
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

  it('responds 405 to GET and DELETE', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await fetch(mcpUrl, { method, headers: { 'api-key': API_KEY } });
      expect(res.status).toBe(StatusMap['Method Not Allowed']);
    }
  });
});
