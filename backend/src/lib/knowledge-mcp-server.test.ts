import { describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { BadRequestError, ConflictError, NotFoundError } from '#lib/errors.ts';
import {
  createKnowledgeMcpServer,
  type KnowledgeReader,
  type KnowledgeTypesReader,
  type PeopleReader,
  type RecordsReader,
} from '#lib/knowledge-mcp-server.ts';
import type { PersonFilters } from '#repositories/people.repository.ts';
import type { SearchParams } from '#repositories/records.repository.ts';
import type {
  CreateKnowledge,
  KnowledgeItem,
  KnowledgeSearchRequest,
  UpdateKnowledge,
} from '#services/knowledge.service.ts';

const KNOWLEDGE_ID = '019e8882-07f1-771c-993e-f6825a9224bb';
const LINKED_KNOWLEDGE_ID = '019e8882-07f1-771c-993e-f6825a9224bc';
const KNOWLEDGE_TYPE_ID = '019e8882-07f1-77ad-bcc8-bccf9c4b81c8';
const DATA_SOURCE_ID = '019e8882-07f1-77a0-b4cf-5798eafb4664';
const DATA_SOURCE_KEY = 'slack';
const PERSON_ID = '019e8882-07f1-779b-9a26-56602bcd1b3f';
const RECORD_ID = '019e8882-07f1-77c5-934a-0e53d907a839';
const PERSON_NAME = 'Ada Lovelace';
const PERSON_EMAIL = 'ada@example.com';
const INDEX_HTML = `<html><body><a href="/knowledge/pages/${KNOWLEDGE_ID}">Onboarding</a></body></html>`;
const PAGE_HTML = '<html><body><h1>Onboarding</h1></body></html>';

const KNOWLEDGE_ITEM: KnowledgeItem = {
  id: KNOWLEDGE_ID,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  title: 'Q1 pricing decision',
  body: '<p>Keep the starter tier free.</p>',
  html_url: `/knowledge/pages/${KNOWLEDGE_ID}`,
  knowledge_type: { id: KNOWLEDGE_TYPE_ID, name: 'decision' },
  participants: [
    {
      id: PERSON_ID,
      name: PERSON_NAME,
      email: PERSON_EMAIL,
      is_external: false,
      handle: 'U07ABC',
    },
  ],
  source_record_ids: [RECORD_ID],
};

const config = {
  baseUrl: 'http://localhost:3010',
  issuer: 'http://localhost:3010/api/auth',
  scopes: ['openid', 'mcp'],
  authHandler: () => Promise.resolve(new Response(null, { status: 404 })),
};

class MockKnowledgeReader implements KnowledgeReader {
  readonly searchCalls: KnowledgeSearchRequest[] = [];
  readonly getCalls: string[] = [];
  readonly createCalls: CreateKnowledge[] = [];
  readonly updateCalls: Array<{ id: string; input: UpdateKnowledge }> = [];
  readonly removeCalls: string[] = [];

  constructor(
    private readonly errors: Partial<
      Record<'search' | 'get' | 'create' | 'update' | 'remove' | 'page', Error>
    > = {},
  ) {}

  search(params: KnowledgeSearchRequest) {
    this.searchCalls.push(params);
    if (this.errors.search) {
      return Promise.reject(this.errors.search);
    }
    return Promise.resolve({
      total: 1,
      limit: params.limit,
      offset: params.offset,
      results:
        params.view === 'full'
          ? [{ ...KNOWLEDGE_ITEM, score: 0.9, snippet: '<b>starter</b>' }]
          : [{ id: KNOWLEDGE_ID, title: KNOWLEDGE_ITEM.title }],
    });
  }

  getKnowledge(id: string) {
    this.getCalls.push(id);
    return this.errors.get ? Promise.reject(this.errors.get) : Promise.resolve(KNOWLEDGE_ITEM);
  }

  getKnowledgeIndexHtmlPage() {
    return Promise.resolve(INDEX_HTML);
  }

  getKnowledgeHtmlPage(id: string) {
    if (this.errors.page) {
      return Promise.reject(this.errors.page);
    }
    return id === KNOWLEDGE_ID
      ? Promise.resolve(PAGE_HTML)
      : Promise.reject(new NotFoundError(`Knowledge not found: ${id}`));
  }

  create(input: CreateKnowledge) {
    this.createCalls.push(input);
    return this.errors.create
      ? Promise.reject(this.errors.create)
      : Promise.resolve(KNOWLEDGE_ITEM);
  }

  update(id: string, input: UpdateKnowledge) {
    this.updateCalls.push({ id, input });
    return this.errors.update
      ? Promise.reject(this.errors.update)
      : Promise.resolve(KNOWLEDGE_ITEM);
  }

  remove(id: string) {
    this.removeCalls.push(id);
    return this.errors.remove ? Promise.reject(this.errors.remove) : Promise.resolve(id);
  }
}

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
          id: RECORD_ID,
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

class MockKnowledgeTypesReader implements KnowledgeTypesReader {
  readonly createCalls: string[] = [];
  readonly updateCalls: Array<{ id: string; name: string }> = [];

  constructor(private readonly errors: Partial<Record<'create' | 'update', Error>> = {}) {}

  list() {
    return Promise.resolve([{ id: KNOWLEDGE_TYPE_ID, name: 'decision' }]);
  }

  create(name: string) {
    this.createCalls.push(name);
    return this.errors.create
      ? Promise.reject(this.errors.create)
      : Promise.resolve({ id: KNOWLEDGE_TYPE_ID, name });
  }

  update(id: string, name: string) {
    this.updateCalls.push({ id, name });
    return this.errors.update ? Promise.reject(this.errors.update) : Promise.resolve({ id, name });
  }
}

type MockServices = Partial<{
  knowledge: MockKnowledgeReader;
  records: MockRecordsReader;
  people: MockPeopleReader;
  knowledgeTypes: MockKnowledgeTypesReader;
}>;

async function connectClient(services: MockServices = {}): Promise<{
  client: Client;
  knowledge: MockKnowledgeReader;
  records: MockRecordsReader;
  people: MockPeopleReader;
  knowledgeTypes: MockKnowledgeTypesReader;
}> {
  const knowledge = services.knowledge ?? new MockKnowledgeReader();
  const records = services.records ?? new MockRecordsReader();
  const people = services.people ?? new MockPeopleReader();
  const knowledgeTypes = services.knowledgeTypes ?? new MockKnowledgeTypesReader();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createKnowledgeMcpServer({ knowledge, records, people, knowledgeTypes }, config)
    .getServerForSession()
    .connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, knowledge, records, people, knowledgeTypes };
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
  it('exposes the knowledge, record, source, people, and type tools', async () => {
    const { client } = await connectClient();
    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name).sort();

    expect(toolNames).toEqual([
      'create_knowledge',
      'create_knowledge_type',
      'delete_knowledge',
      'get_data_sources',
      'get_index_page',
      'get_knowledge',
      'get_knowledge_types',
      'get_page',
      'get_people',
      'get_records',
      'search_knowledge',
      'update_knowledge',
      'update_knowledge_type',
    ]);
    expect(toolNames).not.toContain('delete_knowledge_type');
  });

  it('marks delete_knowledge as destructive', async () => {
    const { client } = await connectClient();
    const { tools } = await client.listTools();

    expect(tools.find((tool) => tool.name === 'delete_knowledge')?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    });
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
      arguments: { id: KNOWLEDGE_ID },
    })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{ type: 'text', text: PAGE_HTML }]);
  });

  it('reports a missing page as a tool error', async () => {
    const { client } = await connectClient();
    const result = (await client.callTool({
      name: 'get_page',
      arguments: { id: LINKED_KNOWLEDGE_ID },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: `Knowledge not found: ${LINKED_KNOWLEDGE_ID}` },
    ]);
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
    const { client } = await connectClient({ records, people });

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
    expect(parseJsonContent(result)).toMatchObject({ total: 1, limit: 50, offset: 50 });
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

  it('returns people with ids for record filters and knowledge writes', async () => {
    const people = new MockPeopleReader();
    const { client } = await connectClient({ people });

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
          id: PERSON_ID,
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
    const { client } = await connectClient({ records });

    const result = (await client.callTool({
      name: 'get_records',
      arguments: { people: ['Unknown Person'], limit: 10, offset: 0 },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(records.searchCalls).toEqual([]);
    expect(parseJsonContent(result)).toEqual({ total: 0, limit: 10, offset: 0, results: [] });
  });

  it('rejects people, records, and knowledge pages larger than 50', async () => {
    const { client } = await connectClient();

    for (const name of ['get_people', 'get_records', 'search_knowledge']) {
      const result = (await client.callTool({
        name,
        arguments: { limit: 51 },
      })) as CallToolResult;

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('Input validation error') },
      ]);
    }
  });

  it('searches knowledge with defaults', async () => {
    const knowledge = new MockKnowledgeReader();
    const { client } = await connectClient({ knowledge });

    const result = (await client.callTool({
      name: 'search_knowledge',
      arguments: {},
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(knowledge.searchCalls).toEqual([{ limit: 20, offset: 0 }]);
    expect(parseJsonContent(result)).toEqual({
      total: 1,
      limit: 20,
      offset: 0,
      results: [{ id: KNOWLEDGE_ID, title: KNOWLEDGE_ITEM.title }],
    });
  });

  it('passes knowledge search filters through to the service', async () => {
    const knowledge = new MockKnowledgeReader();
    const { client } = await connectClient({ knowledge });

    const result = (await client.callTool({
      name: 'search_knowledge',
      arguments: {
        q: 'pricing',
        knowledge_type_id: KNOWLEDGE_TYPE_ID,
        person_ids: [PERSON_ID],
        record_id: RECORD_ID,
        sort_by: 'relevance',
        sort_order: 'asc',
        view: 'full',
        limit: 50,
        offset: 50,
      },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(knowledge.searchCalls).toEqual([
      {
        query: 'pricing',
        knowledgeTypeId: KNOWLEDGE_TYPE_ID,
        personIds: [PERSON_ID],
        recordId: RECORD_ID,
        sortBy: 'relevance',
        sortOrder: 'asc',
        view: 'full',
        limit: 50,
        offset: 50,
      },
    ]);
    expect(parseJsonContent(result)).toMatchObject({
      total: 1,
      limit: 50,
      offset: 50,
      results: [{ id: KNOWLEDGE_ID, score: 0.9 }],
    });
  });

  it('gets knowledge by id', async () => {
    const knowledge = new MockKnowledgeReader();
    const { client } = await connectClient({ knowledge });

    const result = (await client.callTool({
      name: 'get_knowledge',
      arguments: { id: KNOWLEDGE_ID },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(knowledge.getCalls).toEqual([KNOWLEDGE_ID]);
    expect(parseJsonContent(result)).toEqual(KNOWLEDGE_ITEM);
  });

  it('maps knowledge service errors to tool errors', async () => {
    const { client } = await connectClient({
      knowledge: new MockKnowledgeReader({
        get: new NotFoundError(`Knowledge not found: ${KNOWLEDGE_ID}`),
      }),
    });

    const result = (await client.callTool({
      name: 'get_knowledge',
      arguments: { id: KNOWLEDGE_ID },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: `Knowledge not found: ${KNOWLEDGE_ID}` },
    ]);
  });

  it('creates knowledge with id-based references', async () => {
    const knowledge = new MockKnowledgeReader();
    const { client } = await connectClient({ knowledge });

    const result = (await client.callTool({
      name: 'create_knowledge',
      arguments: {
        title: KNOWLEDGE_ITEM.title,
        body: KNOWLEDGE_ITEM.body,
        knowledge_type_id: KNOWLEDGE_TYPE_ID,
        person_ids: [PERSON_ID],
        record_ids: [RECORD_ID],
      },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(knowledge.createCalls).toEqual([
      {
        title: KNOWLEDGE_ITEM.title,
        body: KNOWLEDGE_ITEM.body,
        knowledge_type_id: KNOWLEDGE_TYPE_ID,
        person_ids: [PERSON_ID],
        record_ids: [RECORD_ID],
      },
    ]);
    expect(parseJsonContent(result)).toEqual(KNOWLEDGE_ITEM);
  });

  it('maps create knowledge service errors to tool errors', async () => {
    const { client } = await connectClient({
      knowledge: new MockKnowledgeReader({
        create: new BadRequestError(`unknown knowledge_type_id: ${KNOWLEDGE_TYPE_ID}`),
      }),
    });

    const result = (await client.callTool({
      name: 'create_knowledge',
      arguments: {
        title: KNOWLEDGE_ITEM.title,
        body: KNOWLEDGE_ITEM.body,
        knowledge_type_id: KNOWLEDGE_TYPE_ID,
      },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: `unknown knowledge_type_id: ${KNOWLEDGE_TYPE_ID}` },
    ]);
  });

  it('updates knowledge with partial fields', async () => {
    const knowledge = new MockKnowledgeReader();
    const { client } = await connectClient({ knowledge });

    const result = (await client.callTool({
      name: 'update_knowledge',
      arguments: {
        id: KNOWLEDGE_ID,
        title: 'New title',
        person_ids: [],
      },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(knowledge.updateCalls).toEqual([
      {
        id: KNOWLEDGE_ID,
        input: {
          title: 'New title',
          body: undefined,
          knowledge_type_id: undefined,
          person_ids: [],
          record_ids: undefined,
        },
      },
    ]);
    expect(parseJsonContent(result)).toEqual(KNOWLEDGE_ITEM);
  });

  it('rejects an empty knowledge update body', async () => {
    const { client } = await connectClient();

    const result = (await client.callTool({
      name: 'update_knowledge',
      arguments: { id: KNOWLEDGE_ID },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'At least one update field must be provided.' },
    ]);
  });

  it('deletes knowledge by id', async () => {
    const knowledge = new MockKnowledgeReader();
    const { client } = await connectClient({ knowledge });

    const result = (await client.callTool({
      name: 'delete_knowledge',
      arguments: { id: KNOWLEDGE_ID },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(knowledge.removeCalls).toEqual([KNOWLEDGE_ID]);
    expect(parseJsonContent(result)).toEqual({ id: KNOWLEDGE_ID });
  });

  it('maps delete knowledge service errors to tool errors', async () => {
    const { client } = await connectClient({
      knowledge: new MockKnowledgeReader({
        remove: new NotFoundError(`Knowledge not found: ${KNOWLEDGE_ID}`),
      }),
    });

    const result = (await client.callTool({
      name: 'delete_knowledge',
      arguments: { id: KNOWLEDGE_ID },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: `Knowledge not found: ${KNOWLEDGE_ID}` },
    ]);
  });

  it('rejects invalid uuids in knowledge tools', async () => {
    const { client } = await connectClient();

    const result = (await client.callTool({
      name: 'get_knowledge',
      arguments: { id: 'nope' },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('Input validation error') },
    ]);
  });

  it('lists, creates, and updates knowledge types', async () => {
    const knowledgeTypes = new MockKnowledgeTypesReader();
    const { client } = await connectClient({ knowledgeTypes });

    const listed = (await client.callTool({
      name: 'get_knowledge_types',
      arguments: {},
    })) as CallToolResult;
    const created = (await client.callTool({
      name: 'create_knowledge_type',
      arguments: { name: 'decision' },
    })) as CallToolResult;
    const updated = (await client.callTool({
      name: 'update_knowledge_type',
      arguments: { id: KNOWLEDGE_TYPE_ID, name: 'memo' },
    })) as CallToolResult;

    expect(listed.isError).toBeFalsy();
    expect(created.isError).toBeFalsy();
    expect(updated.isError).toBeFalsy();
    expect(parseJsonContent(listed)).toEqual({
      knowledge_types: [{ id: KNOWLEDGE_TYPE_ID, name: 'decision' }],
    });
    expect(parseJsonContent(created)).toEqual({ id: KNOWLEDGE_TYPE_ID, name: 'decision' });
    expect(parseJsonContent(updated)).toEqual({ id: KNOWLEDGE_TYPE_ID, name: 'memo' });
    expect(knowledgeTypes.createCalls).toEqual(['decision']);
    expect(knowledgeTypes.updateCalls).toEqual([{ id: KNOWLEDGE_TYPE_ID, name: 'memo' }]);
  });

  it('maps knowledge type duplicate and missing errors to tool errors', async () => {
    const duplicate = await connectClient({
      knowledgeTypes: new MockKnowledgeTypesReader({
        create: new ConflictError('Knowledge type already exists: decision'),
      }),
    });
    const missing = await connectClient({
      knowledgeTypes: new MockKnowledgeTypesReader({
        update: new NotFoundError(`Knowledge type not found: ${KNOWLEDGE_TYPE_ID}`),
      }),
    });

    const createResult = (await duplicate.client.callTool({
      name: 'create_knowledge_type',
      arguments: { name: 'decision' },
    })) as CallToolResult;
    const updateResult = (await missing.client.callTool({
      name: 'update_knowledge_type',
      arguments: { id: KNOWLEDGE_TYPE_ID, name: 'memo' },
    })) as CallToolResult;

    expect(createResult.isError).toBe(true);
    expect(createResult.content).toEqual([
      { type: 'text', text: 'Knowledge type already exists: decision' },
    ]);
    expect(updateResult.isError).toBe(true);
    expect(updateResult.content).toEqual([
      { type: 'text', text: `Knowledge type not found: ${KNOWLEDGE_TYPE_ID}` },
    ]);
  });
});
