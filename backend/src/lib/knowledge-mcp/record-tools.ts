import type { MCPServer } from 'mcp-use/server';
import { z } from 'zod';
import { resolvePersonIds } from '#lib/knowledge-mcp/people-resolution.ts';
import { readJson } from '#lib/knowledge-mcp/respond.ts';
import type { DataSource, PeopleReader, Person, RecordsReader } from '#lib/knowledge-mcp/types.ts';
import { PERSON_SORT_FIELDS, PERSON_SORT_ORDERS } from '#repositories/people.repository.ts';
import {
  RECORD_SORT_FIELDS,
  RECORD_SORT_ORDERS,
  type SearchParams,
} from '#repositories/records.repository.ts';

const DEFAULT_RECORD_LIMIT = 20;
const MAX_RECORD_LIMIT = 50;
const DEFAULT_PEOPLE_LIMIT = 20;
const MAX_PEOPLE_LIMIT = 50;

export function registerRecordTools(
  server: MCPServer<true>,
  records: RecordsReader,
  people: PeopleReader,
) {
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
        'List people available for get_records and knowledge tools. Use exact names or emails ' +
        'from this response when filtering records or linking knowledge.',
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
    id: person.id,
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
