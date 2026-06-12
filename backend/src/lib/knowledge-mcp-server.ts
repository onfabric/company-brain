import { error, MCPServer, oauthBetterAuthProvider, text } from 'mcp-use/server';
import { z } from 'zod';
import { AppError } from '#lib/errors.ts';
import { createLogger } from '#lib/logger.ts';
import { PERSON_SORT_FIELDS, PERSON_SORT_ORDERS } from '#repositories/people.repository.ts';
import {
  RECORD_SORT_FIELDS,
  RECORD_SORT_ORDERS,
  type SearchParams,
} from '#repositories/records.repository.ts';
import type { PeopleService } from '#services/people.service.ts';
import type { RecordsService } from '#services/records.service.ts';

export type KnowledgePageReader = {
  getKnowledgeIndexHtmlPage(): Promise<string>;
  getKnowledgeHtmlPage(id: string): Promise<string>;
};

export type RecordsReader = Pick<RecordsService, 'search' | 'listSources'>;
export type PeopleReader = Pick<PeopleService, 'listPeople' | 'findByNameOrEmail'>;

type DataSource = Awaited<ReturnType<RecordsReader['listSources']>>['sources'][number];
type Person = Awaited<ReturnType<PeopleReader['listPeople']>>['people'][number];

export type KnowledgeMcpServerConfig = {
  /** Public origin the MCP endpoint and discovery documents are reachable at. */
  baseUrl: string;
  /** better-auth base URL whose JWKS verifies bearer tokens and whose metadata is proxied. */
  issuer: string;
  /** Scopes advertised in the discovery documents. */
  scopes: string[];
  /** better-auth request handler, mounted on the same Hono app under its `/api/auth` basePath. */
  authHandler: (request: Request) => Promise<Response>;
};

const AUTH_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const;

const INSTRUCTIONS =
  'Read-only access to the company knowledge base and source records. ' +
  'Call get_index_page first: the index links every page as /knowledge/pages/{id}. ' +
  'Follow a link by calling get_page with that {id}. Pages may link to further pages the same way. ' +
  'Call get_data_sources and get_people to discover readable record filters. ' +
  'Call get_records with data source keys and people names or emails; each page contains at most 50 records.';

const logger = createLogger('knowledgeMcpServer');
const DEFAULT_RECORD_LIMIT = 20;
const MAX_RECORD_LIMIT = 50;
const DEFAULT_PEOPLE_LIMIT = 20;
const MAX_PEOPLE_LIMIT = 50;

// mcp-use owns the OAuth 2.1 surface for `/mcp`: bearer verification against the
// better-auth JWKS, the 401 `WWW-Authenticate` challenge, and the RFC 8414 /
// RFC 9728 discovery documents. better-auth shares the same Hono app so the
// brain exposes the whole authn/OAuth stack behind a single Elysia mount.
export function createKnowledgeMcpServer(
  pages: KnowledgePageReader,
  records: RecordsReader,
  people: PeopleReader,
  config: KnowledgeMcpServerConfig,
): MCPServer<true> {
  const server = new MCPServer({
    name: 'company-brain',
    version: '1.0.0',
    instructions: INSTRUCTIONS,
    baseUrl: config.baseUrl,
    oauth: oauthBetterAuthProvider({ authURL: config.issuer, scopesSupported: config.scopes }),
  });

  server.app.on([...AUTH_METHODS], '/api/auth/*', (c) => config.authHandler(c.req.raw));

  server.tool(
    {
      name: 'get_index_page',
      description:
        'Fetch the knowledge base index page as HTML. Start here: it links every available page ' +
        'as /knowledge/pages/{id}. Read a linked page with get_page.',
      annotations: { readOnlyHint: true },
    },
    () => readPage(() => pages.getKnowledgeIndexHtmlPage()),
  );

  server.tool(
    {
      name: 'get_page',
      description:
        'Fetch a single knowledge base page as HTML. Take the id from a /knowledge/pages/{id} ' +
        'link on the index page or on another page.',
      schema: z.object({
        id: z.uuid().describe('Page id from a /knowledge/pages/{id} link.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ id }) => readPage(() => pages.getKnowledgeHtmlPage(id)),
  );

  server.tool(
    {
      name: 'get_records',
      description:
        'Pull source records from Company Brain as paginated JSON matching the records API response. ' +
        'Filter by data source key, created/updated time range, and exact participant names or emails. ' +
        'Use limit and offset for pagination; limit cannot exceed 50.',
      schema: z.object({
        q: z
          .string()
          .min(1)
          .optional()
          .describe('Optional full-text query. Omit to list records matching the filters.'),
        data_source_key: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Restrict results to a single data source key from get_data_sources.'),
        people: z
          .array(z.string().trim().min(1))
          .min(1)
          .optional()
          .describe('Restrict results to people whose name or email exactly matches any value.'),
        created_after: z
          .string()
          .min(1)
          .optional()
          .describe('Only records created at or after this timestamp.'),
        created_before: z
          .string()
          .min(1)
          .optional()
          .describe('Only records created before this timestamp.'),
        updated_after: z
          .string()
          .min(1)
          .optional()
          .describe('Only records updated at or after this timestamp.'),
        updated_before: z
          .string()
          .min(1)
          .optional()
          .describe('Only records updated before this timestamp.'),
        sort_by: z.enum(RECORD_SORT_FIELDS).optional().describe('Field used to order records.'),
        sort_order: z
          .enum(RECORD_SORT_ORDERS)
          .optional()
          .describe('Direction used for the selected sort field.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_RECORD_LIMIT)
          .optional()
          .describe('Maximum number of records to return. Must be between 1 and 50.'),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Number of records to skip for pagination.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({
      q,
      data_source_key,
      people: personNamesOrEmails,
      created_after,
      created_before,
      updated_after,
      updated_before,
      sort_by,
      sort_order,
      limit,
      offset,
    }) =>
      readJson(async () => {
        const page = { limit: limit ?? DEFAULT_RECORD_LIMIT, offset: offset ?? 0 };
        const dataSourceId = await resolveDataSourceId(records, data_source_key);
        const personIds = await resolvePersonIds(people, personNamesOrEmails);
        if (dataSourceId === null || personIds?.length === 0) {
          return emptyRecordsPage(page.limit, page.offset);
        }
        const search: SearchParams = {
          query: q,
          dataSourceId,
          personIds,
          createdAfter: created_after,
          createdBefore: created_before,
          updatedAfter: updated_after,
          updatedBefore: updated_before,
          sortBy: sort_by,
          sortOrder: sort_order,
          ...page,
        };
        return records.search(search);
      }),
  );

  server.tool(
    {
      name: 'get_data_sources',
      description:
        'List data sources available for get_records. Use data_source_key from this response ' +
        'when filtering records.',
      annotations: { readOnlyHint: true },
    },
    () =>
      readJson(async () => {
        const { sources } = await records.listSources();
        return { sources: sources.map(toMcpDataSource) };
      }),
  );

  server.tool(
    {
      name: 'get_people',
      description:
        'List people available for get_records filters. People without a name or email are omitted ' +
        'because records can only be filtered by readable names or emails through MCP.',
      schema: z.object({
        q: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Optional case-insensitive match on name, email, or a per-source handle.'),
        is_external: z
          .boolean()
          .optional()
          .describe('Filter to external or internal people. Omit for all.'),
        sort_by: z.enum(PERSON_SORT_FIELDS).optional().describe('Field used to order people.'),
        sort_order: z
          .enum(PERSON_SORT_ORDERS)
          .optional()
          .describe('Direction used for the selected sort field.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PEOPLE_LIMIT)
          .optional()
          .describe('Maximum number of people to return. Must be between 1 and 50.'),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Number of people to skip for pagination.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ q, is_external, sort_by, sort_order, limit, offset }) =>
      readJson(async () => {
        const result = await people.listPeople({
          hasReadableIdentity: true,
          query: q,
          isExternal: is_external,
          sortBy: sort_by,
          sortOrder: sort_order,
          limit: limit ?? DEFAULT_PEOPLE_LIMIT,
          offset: offset ?? 0,
        });
        return {
          total: result.total,
          people: result.people.filter(hasReadableIdentity).map(toMcpPerson),
        };
      }),
  );

  return server;
}

async function readPage(read: () => Promise<string>) {
  try {
    return text(await read());
  } catch (err) {
    if (err instanceof AppError) {
      return error(err.message);
    }
    logger.error('failed to read knowledge page', err);
    return error('Failed to read the knowledge page');
  }
}

async function readJson(read: () => Promise<unknown>) {
  try {
    return text(JSON.stringify(await read(), null, 2));
  } catch (err) {
    if (err instanceof AppError) {
      return error(err.message);
    }
    logger.error('failed to read MCP data', err);
    return error('Failed to read MCP data');
  }
}

async function resolveDataSourceId(
  records: RecordsReader,
  dataSourceKey: string | undefined,
): Promise<string | null | undefined> {
  if (dataSourceKey === undefined) {
    return undefined;
  }
  const { sources } = await records.listSources();
  return sources.find((source) => source.data_source_key === dataSourceKey)?.data_source_id ?? null;
}

async function resolvePersonIds(
  people: PeopleReader,
  namesOrEmails: string[] | undefined,
): Promise<string[] | undefined> {
  if (namesOrEmails === undefined) {
    return undefined;
  }
  const matches = await people.findByNameOrEmail(namesOrEmails);
  return [...new Set(matches.map((person) => person.id))];
}

function emptyRecordsPage(limit: number, offset: number) {
  return { total: offset === 0 ? 0 : null, limit, offset, results: [] };
}

function toMcpDataSource(source: DataSource) {
  return {
    data_source_key: source.data_source_key,
    count: source.count,
    oldest_created_at: source.oldest_created_at,
    newest_created_at: source.newest_created_at,
    newest_updated_at: source.newest_updated_at,
  };
}

function toMcpPerson(person: Person) {
  return {
    name: person.name,
    email: person.email,
    is_external: person.is_external,
    data_sources: person.data_sources,
    records_count: person.records_count,
  };
}

function hasReadableIdentity(person: Person) {
  return person.name !== null || person.email !== null;
}
