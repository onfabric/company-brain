import { describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { NotFoundError } from '#lib/errors.ts';
import {
  createKnowledgeMcpServer,
  type KnowledgePageReader,
  type PeopleReader,
  type RecordsReader,
} from '#lib/knowledge-mcp-server.ts';
import type { PersonFilters } from '#repositories/people.repository.ts';
import type { SearchParams } from '#repositories/records.repository.ts';

const PAGE_ID = '019e8882-07f1-771c-993e-f6825a9224bb';
const DATA_SOURCE_ID = '019e8882-07f1-77a0-b4cf-5798eafb4664';
const DATA_SOURCE_KEY = 'slack';
const PERSON_ID = '019e8882-07f1-779b-9a26-56602bcd1b3f';
const PERSON_NAME = 'Ada Lovelace';
const PERSON_EMAIL = 'ada@example.com';
const INDEX_HTML = `<html><body><a href="/knowledge/pages/${PAGE_ID}">Onboarding</a></body></html>`;
const PAGE_HTML = '<html><body><h1>Onboarding</h1></body></html>';

const pages: KnowledgePageReader = {
  getKnowledgeIndexHtmlPage: () => Promise.resolve(INDEX_HTML),
  getKnowledgeHtmlPage: (id) =>
    id === PAGE_ID
      ? Promise.resolve(PAGE_HTML)
      : Promise.reject(new NotFoundError(`Knowledge not found: ${id}`)),
};

const config = {
  baseUrl: 'http://localhost:3010',
  issuer: 'http://localhost:3010/api/auth',
  scopes: ['openid', 'mcp'],
  authHandler: () => Promise.resolve(new Response(null, { status: 404 })),
};

class MockRecordsReader implements RecordsReader {
  readonly searchCalls: SearchParams[] = [];
  listSourcesCalls = 0;

  search(params: SearchParams) {
    this.searchCalls.push(params);
    return Promise.resolve({
      total: 1,
      limit: params.limit,
      offset: params.offset,
      results: [
        {
          id: PAGE_ID,
          data_source_id: DATA_SOURCE_ID,
          data_source_key: DATA_SOURCE_KEY,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
          body: 'hello world',
          participants: [
            {
              id: PERSON_ID,
              name: PERSON_NAME,
              email: PERSON_EMAIL,
              is_external: false,
              handle: 'U07ABC',
            },
          ],
          score: null,
          snippet: null,
        },
      ],
    });
  }

  listSources() {
    this.listSourcesCalls += 1;
    return Promise.resolve({
      sources: [
        {
          data_source_id: DATA_SOURCE_ID,
          data_source_key: DATA_SOURCE_KEY,
          count: 8,
          oldest_created_at: '2026-01-01T00:00:00.000Z',
          newest_created_at: '2026-02-01T00:00:00.000Z',
          newest_updated_at: '2026-02-02T00:00:00.000Z',
        },
      ],
    });
  }
}

class MockPeopleReader implements PeopleReader {
  readonly listCalls: PersonFilters[] = [];
  readonly findCalls: string[][] = [];

  listPeople(filters: PersonFilters = {}) {
    this.listCalls.push(filters);
    return Promise.resolve({
      total: 1,
      people: [
        {
          id: PERSON_ID,
          name: PERSON_NAME,
          email: PERSON_EMAIL,
          is_external: false,
          data_sources: [{ data_source_key: DATA_SOURCE_KEY, data_source_user_id: 'U07ABC' }],
          records_count: 4,
        },
      ],
    });
  }

  findByNameOrEmail(values: string[]) {
    this.findCalls.push(values);
    return Promise.resolve(
      values.some((value) => value === PERSON_NAME || value === PERSON_EMAIL)
        ? [{ id: PERSON_ID, name: PERSON_NAME, email: PERSON_EMAIL }]
        : [],
    );
  }
}

async function connectClient(
  records = new MockRecordsReader(),
  people = new MockPeopleReader(),
): Promise<{ client: Client; records: MockRecordsReader; people: MockPeopleReader }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createKnowledgeMcpServer(pages, records, people, config)
    .getServerForSession()
    .connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, records, people };
}

function parseJsonContent(result: CallToolResult): unknown {
  const [content] = result.content;
  expect(content?.type).toBe('text');
  if (content?.type !== 'text') {
    throw new Error('expected text content');
  }
  return JSON.parse(content.text);
}

describe('knowledge mcp server', () => {
  it('exposes the index, page, source, people, and records tools', async () => {
    const { client } = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_data_sources',
      'get_index_page',
      'get_page',
      'get_people',
      'get_records',
    ]);
  });

  it('returns the index page', async () => {
    const { client } = await connectClient();
    const result = (await client.callTool({
      name: 'get_index_page',
      arguments: {},
    })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{ type: 'text', text: INDEX_HTML }]);
  });

  it('returns a page by id', async () => {
    const { client } = await connectClient();
    const result = (await client.callTool({
      name: 'get_page',
      arguments: { id: PAGE_ID },
    })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{ type: 'text', text: PAGE_HTML }]);
  });

  it('reports a missing page as a tool error', async () => {
    const { client } = await connectClient();
    const missingId = '00000000-0000-4000-8000-000000000000';
    const result = (await client.callTool({
      name: 'get_page',
      arguments: { id: missingId },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: `Knowledge not found: ${missingId}` }]);
  });

  it('rejects a page id that is not a uuid', async () => {
    const { client } = await connectClient();
    const result = (await client.callTool({
      name: 'get_page',
      arguments: { id: 'index' },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('Input validation error') },
    ]);
  });

  it('returns filtered records as paginated JSON', async () => {
    const records = new MockRecordsReader();
    const people = new MockPeopleReader();
    const { client } = await connectClient(records, people);

    const result = (await client.callTool({
      name: 'get_records',
      arguments: {
        q: 'hello',
        data_source_key: DATA_SOURCE_KEY,
        people: [PERSON_NAME],
        created_after: '2026-01-01T00:00:00Z',
        created_before: '2026-02-01T00:00:00Z',
        updated_after: '2026-01-01T00:00:00Z',
        updated_before: '2026-03-01T00:00:00Z',
        sort_by: 'updated_at',
        sort_order: 'asc',
        limit: 50,
        offset: 50,
      },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(records.listSourcesCalls).toBe(1);
    expect(people.findCalls).toEqual([[PERSON_NAME]]);
    expect(records.searchCalls).toEqual([
      {
        query: 'hello',
        dataSourceId: DATA_SOURCE_ID,
        personIds: [PERSON_ID],
        createdAfter: '2026-01-01T00:00:00Z',
        createdBefore: '2026-02-01T00:00:00Z',
        updatedAfter: '2026-01-01T00:00:00Z',
        updatedBefore: '2026-03-01T00:00:00Z',
        sortBy: 'updated_at',
        sortOrder: 'asc',
        limit: 50,
        offset: 50,
      },
    ]);
    expect(parseJsonContent(result)).toEqual({
      total: 1,
      limit: 50,
      offset: 50,
      results: [
        {
          id: PAGE_ID,
          data_source_id: DATA_SOURCE_ID,
          data_source_key: DATA_SOURCE_KEY,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
          body: 'hello world',
          participants: [
            {
              id: PERSON_ID,
              name: PERSON_NAME,
              email: PERSON_EMAIL,
              is_external: false,
              handle: 'U07ABC',
            },
          ],
          score: null,
          snippet: null,
        },
      ],
    });
  });

  it('returns data sources without requiring clients to know source ids', async () => {
    const { client } = await connectClient();

    const result = (await client.callTool({
      name: 'get_data_sources',
      arguments: {},
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(parseJsonContent(result)).toEqual({
      sources: [
        {
          data_source_key: DATA_SOURCE_KEY,
          count: 8,
          oldest_created_at: '2026-01-01T00:00:00.000Z',
          newest_created_at: '2026-02-01T00:00:00.000Z',
          newest_updated_at: '2026-02-02T00:00:00.000Z',
        },
      ],
    });
  });

  it('returns only people with readable names or emails for record filters', async () => {
    const people = new MockPeopleReader();
    const { client } = await connectClient(new MockRecordsReader(), people);

    const result = (await client.callTool({
      name: 'get_people',
      arguments: { q: 'ada', limit: 50, offset: 0 },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(people.listCalls).toEqual([
      {
        hasReadableIdentity: true,
        query: 'ada',
        isExternal: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        limit: 50,
        offset: 0,
      },
    ]);
    expect(parseJsonContent(result)).toEqual({
      total: 1,
      people: [
        {
          name: PERSON_NAME,
          email: PERSON_EMAIL,
          is_external: false,
          data_sources: [{ data_source_key: DATA_SOURCE_KEY, data_source_user_id: 'U07ABC' }],
          records_count: 4,
        },
      ],
    });
  });

  it('returns an empty record page when readable filters do not resolve', async () => {
    const records = new MockRecordsReader();
    const { client } = await connectClient(records);

    const result = (await client.callTool({
      name: 'get_records',
      arguments: { people: ['Unknown Person'], limit: 10, offset: 0 },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(records.searchCalls).toEqual([]);
    expect(parseJsonContent(result)).toEqual({ total: 0, limit: 10, offset: 0, results: [] });
  });

  it('rejects people pages larger than 50', async () => {
    const { client } = await connectClient();
    const result = (await client.callTool({
      name: 'get_people',
      arguments: { limit: 51 },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('Input validation error') },
    ]);
  });

  it('rejects records pages larger than 50', async () => {
    const { client } = await connectClient();
    const result = (await client.callTool({
      name: 'get_records',
      arguments: { limit: 51 },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('Input validation error') },
    ]);
  });
});
