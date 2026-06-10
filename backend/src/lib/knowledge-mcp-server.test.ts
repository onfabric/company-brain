import { describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { NotFoundError } from '#lib/errors.ts';
import { createKnowledgeMcpServer, type KnowledgePageReader } from '#lib/knowledge-mcp-server.ts';

const PAGE_ID = '019e8882-07f1-771c-993e-f6825a9224bb';
const INDEX_HTML = `<html><body><a href="/knowledge/pages/${PAGE_ID}">Onboarding</a></body></html>`;
const PAGE_HTML = '<html><body><h1>Onboarding</h1></body></html>';

const pages: KnowledgePageReader = {
  getKnowledgeIndexHtmlPage: () => Promise.resolve(INDEX_HTML),
  getKnowledgeHtmlPage: (id) =>
    id === PAGE_ID
      ? Promise.resolve(PAGE_HTML)
      : Promise.reject(new NotFoundError(`Knowledge not found: ${id}`)),
};

async function connectClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createKnowledgeMcpServer(pages).connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

describe('knowledge mcp server', () => {
  it('exposes the index and page tools', async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['get_index_page', 'get_page']);
  });

  it('returns the index page', async () => {
    const client = await connectClient();
    const result = (await client.callTool({ name: 'get_index_page' })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{ type: 'text', text: INDEX_HTML }]);
  });

  it('returns a page by id', async () => {
    const client = await connectClient();
    const result = (await client.callTool({
      name: 'get_page',
      arguments: { id: PAGE_ID },
    })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{ type: 'text', text: PAGE_HTML }]);
  });

  it('reports a missing page as a tool error', async () => {
    const client = await connectClient();
    const missingId = '00000000-0000-4000-8000-000000000000';
    const result = (await client.callTool({
      name: 'get_page',
      arguments: { id: missingId },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: `Knowledge not found: ${missingId}` }]);
  });

  it('rejects a page id that is not a uuid', async () => {
    const client = await connectClient();
    const result = (await client.callTool({
      name: 'get_page',
      arguments: { id: 'index' },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('Input validation error') },
    ]);
  });
});
