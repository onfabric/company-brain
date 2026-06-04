import type {
  RawNotionBlock,
  RawNotionDatabase,
  RawNotionDataSource,
  RawNotionPage,
  RawNotionUser,
} from './api-types.js';
import type { SyncContext, WorkQueue } from './context.js';
import { titleFromRichText } from './rich-text.js';
import {
  arrayValue,
  isRecord,
  notionHeaders,
  notionPaginationParams,
  notionUrlFromId,
  pageSize,
  withoutUndefined,
} from './utils.js';

const PROXY_RETRIES = 5;

type PaginatedResponse = {
  results?: unknown;
  next_cursor?: unknown;
};

export async function enqueueSearchResults(
  ctx: SyncContext,
  pageQueue: WorkQueue,
  dataSourceQueue: WorkQueue,
): Promise<void> {
  for (const result of await searchObjects(ctx, 'page')) {
    if (isRawPage(result)) {
      pageQueue.add(result.id);
    }
  }

  for (const result of await searchObjects(ctx, 'data_source')) {
    if (isRawDataSource(result)) {
      ctx.dataSourcesById.set(result.id, result);
      dataSourceQueue.add(result.id);
    }
  }
}

export async function enqueueDataSourcePages(
  ctx: SyncContext,
  dataSourceId: string,
  pageQueue: WorkQueue,
  dataSourceQueue: WorkQueue,
): Promise<void> {
  let cursor: string | undefined;

  do {
    const response = await ctx.nango.post({
      endpoint: `/v1/data_sources/${dataSourceId}/query`,
      data: withoutUndefined({
        page_size: pageSize(ctx.metadata),
        start_cursor: cursor,
        in_trash: ctx.metadata?.includeTrashed ? undefined : false,
      }),
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    const data = asPaginatedResponse(response.data);

    for (const result of arrayValue(data.results)) {
      if (isRawPage(result)) {
        pageQueue.add(result.id);
      } else if (isRawDataSource(result)) {
        ctx.dataSourcesById.set(result.id, result);
        dataSourceQueue.add(result.id);
      }
    }

    cursor = typeof data.next_cursor === 'string' ? data.next_cursor : undefined;
  } while (cursor);
}

export async function enqueueDatabaseDataSources(
  ctx: SyncContext,
  databaseId: string,
  dataSourceQueue: WorkQueue,
): Promise<void> {
  const database = await tryFetchDatabase(ctx, databaseId);
  if (!database) {
    return;
  }

  for (const dataSource of database.data_sources ?? []) {
    if (dataSource.id) {
      dataSourceQueue.add(dataSource.id);
      ctx.dataSourceRefsById.set(
        dataSource.id,
        withoutUndefined({
          title: dataSource.name ?? titleFromRichText(database.title) ?? 'Notion data source',
          url: database.url ?? notionUrlFromId(database.id),
        }),
      );
    }
  }
}

export async function fetchBlockChildren(
  ctx: SyncContext,
  blockId: string,
): Promise<RawNotionBlock[]> {
  const blocks: RawNotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await ctx.nango.get({
      endpoint: `/v1/blocks/${blockId}/children`,
      params: notionPaginationParams(ctx.metadata, cursor),
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    const data = asPaginatedResponse(response.data);
    blocks.push(...arrayValue(data.results).filter(isRawBlock));
    cursor = typeof data.next_cursor === 'string' ? data.next_cursor : undefined;
  } while (cursor);

  return blocks;
}

export async function tryFetchPage(
  ctx: SyncContext,
  pageId: string,
): Promise<RawNotionPage | undefined> {
  try {
    const response = await ctx.nango.get({
      endpoint: `/v1/pages/${pageId}`,
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    return isRawPage(response.data) ? response.data : undefined;
  } catch {
    return undefined;
  }
}

export async function tryFetchBlock(
  ctx: SyncContext,
  blockId: string,
): Promise<RawNotionBlock | undefined> {
  try {
    const response = await ctx.nango.get({
      endpoint: `/v1/blocks/${blockId}`,
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    return isRawBlock(response.data) ? response.data : undefined;
  } catch {
    return undefined;
  }
}

export async function tryFetchDatabase(
  ctx: SyncContext,
  databaseId: string,
): Promise<RawNotionDatabase | undefined> {
  if (!databaseId) {
    return undefined;
  }

  const cached = ctx.databasesById.get(databaseId);
  if (cached) {
    return cached;
  }

  try {
    const response = await ctx.nango.get({
      endpoint: `/v1/databases/${databaseId}`,
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    if (!isRawDatabase(response.data)) {
      return undefined;
    }
    ctx.databasesById.set(databaseId, response.data);
    return response.data;
  } catch {
    return undefined;
  }
}

export async function tryFetchDataSource(
  ctx: SyncContext,
  dataSourceId: string,
): Promise<RawNotionDataSource | undefined> {
  const cached = ctx.dataSourcesById.get(dataSourceId);
  if (cached) {
    return cached;
  }

  try {
    const response = await ctx.nango.get({
      endpoint: `/v1/data_sources/${dataSourceId}`,
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    if (!isRawDataSource(response.data)) {
      return undefined;
    }
    ctx.dataSourcesById.set(dataSourceId, response.data);
    return response.data;
  } catch {
    return undefined;
  }
}

// Notion inlines only partial user objects (id, no email) on most page payloads,
// so a person referenced as created_by/last_edited_by/mention would otherwise be
// keyed by UUID. One pass over /v1/users gives a stable id->email directory used to
// resolve every reference back to the email. Empty emails (bots, guests, or a missing
// "read user information including email" capability) are skipped and fall back to id.
export async function loadUserDirectory(ctx: SyncContext): Promise<void> {
  let cursor: string | undefined;

  do {
    const response = await ctx.nango.get({
      endpoint: '/v1/users',
      params: notionPaginationParams(ctx.metadata, cursor),
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    const data = asPaginatedResponse(response.data);

    for (const result of arrayValue(data.results)) {
      const user = result as RawNotionUser;
      const email = user.person?.email;
      if (typeof user.id === 'string' && email) {
        ctx.userEmailsById.set(user.id, email);
      }
    }

    cursor = typeof data.next_cursor === 'string' ? data.next_cursor : undefined;
  } while (cursor);
}

async function searchObjects(ctx: SyncContext, object: 'page' | 'data_source'): Promise<unknown[]> {
  const results: unknown[] = [];
  let cursor: string | undefined;

  do {
    const response = await ctx.nango.post({
      endpoint: '/v1/search',
      data: withoutUndefined({
        page_size: pageSize(ctx.metadata),
        start_cursor: cursor,
        filter: {
          property: 'object',
          value: object,
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time',
        },
      }),
      headers: notionHeaders(),
      retries: PROXY_RETRIES,
    });
    const data = asPaginatedResponse(response.data);
    results.push(...arrayValue(data.results));
    cursor = typeof data.next_cursor === 'string' ? data.next_cursor : undefined;
  } while (cursor);

  return results;
}

function isRawPage(value: unknown): value is RawNotionPage {
  const record = value as { object?: unknown; id?: unknown };
  return isRecord(value) && record.object === 'page' && typeof record.id === 'string';
}

function isRawDatabase(value: unknown): value is RawNotionDatabase {
  const record = value as { object?: unknown; id?: unknown };
  return isRecord(value) && record.object === 'database' && typeof record.id === 'string';
}

function isRawDataSource(value: unknown): value is RawNotionDataSource {
  const record = value as { object?: unknown; id?: unknown };
  return isRecord(value) && record.object === 'data_source' && typeof record.id === 'string';
}

function isRawBlock(value: unknown): value is RawNotionBlock {
  const record = value as { object?: unknown; id?: unknown };
  return isRecord(value) && record.object === 'block' && typeof record.id === 'string';
}

function asPaginatedResponse(value: unknown): PaginatedResponse {
  return isRecord(value) ? (value as PaginatedResponse) : {};
}
