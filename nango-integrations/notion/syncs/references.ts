import type { RawNotionPage, RawNotionParent } from './api-types.js';
import { tryFetchBlock, tryFetchDatabase, tryFetchDataSource, tryFetchPage } from './client.js';
import type { SyncContext } from './context.js';
import type { NotionParent, NotionReference } from './models.js';
import { titleFromRichText } from './rich-text.js';
import { notionUrlFromId, withoutUndefined } from './utils.js';

const MAX_BLOCK_PARENT_HOPS = 8;

export async function mapParent(
  ctx: SyncContext,
  parent: RawNotionParent | undefined,
): Promise<NotionParent> {
  if (!parent?.type || parent.type === 'workspace') {
    return { type: 'workspace', title: 'Workspace' };
  }

  if (parent.type === 'page_id' && parent.page_id) {
    const ref = await referenceForPageId(ctx, parent.page_id);
    return withoutUndefined({ type: 'page' as const, title: ref.title, url: ref.url });
  }

  if (parent.type === 'data_source_id' && parent.data_source_id) {
    const ref = await referenceForDataSourceId(ctx, parent.data_source_id, parent.database_id);
    return withoutUndefined({ type: 'data_source' as const, title: ref.title, url: ref.url });
  }

  if (parent.type === 'database_id' && parent.database_id) {
    const ref = await referenceForDatabaseId(ctx, parent.database_id);
    return withoutUndefined({ type: 'database' as const, title: ref.title, url: ref.url });
  }

  if (parent.type === 'block_id' && parent.block_id) {
    const ref = await referenceForBlockParent(ctx, parent.block_id);
    return withoutUndefined({ type: 'block' as const, title: ref.title, url: ref.url });
  }

  if (parent.type === 'agent_id') {
    return { type: 'agent', title: 'Notion agent' };
  }

  return { type: 'unknown' };
}

export async function referenceForPageId(
  ctx: SyncContext,
  pageId: string,
): Promise<NotionReference> {
  const cached = ctx.pageRefsById.get(pageId);
  if (cached) {
    return cached;
  }

  const page = await tryFetchPage(ctx, pageId);
  const ref = withoutUndefined({
    title: page ? (titleFromPage(page) ?? 'Notion page') : 'Notion page',
    url: page?.url ?? notionUrlFromId(pageId),
  });
  ctx.pageRefsById.set(pageId, ref);
  return ref;
}

export async function referenceForDatabaseId(
  ctx: SyncContext,
  databaseId: string,
): Promise<NotionReference> {
  const cached = ctx.databaseRefsById.get(databaseId);
  if (cached) {
    return cached;
  }

  const database = await tryFetchDatabase(ctx, databaseId);
  const ref = withoutUndefined({
    title: database ? (titleFromRichText(database.title) ?? 'Notion database') : 'Notion database',
    url: database?.url ?? notionUrlFromId(databaseId),
  });
  ctx.databaseRefsById.set(databaseId, ref);
  return ref;
}

export async function referenceForDataSourceId(
  ctx: SyncContext,
  dataSourceId: string,
  databaseId: string | undefined,
): Promise<NotionReference> {
  const cached = ctx.dataSourceRefsById.get(dataSourceId);
  if (cached) {
    return cached;
  }

  const dataSource = await tryFetchDataSource(ctx, dataSourceId);
  const dataSourceDatabaseId =
    databaseId ??
    (dataSource?.parent?.type === 'database_id' ? dataSource.parent.database_id : undefined);
  const databaseRef = dataSourceDatabaseId
    ? await referenceForDatabaseId(ctx, dataSourceDatabaseId)
    : undefined;
  const ref = withoutUndefined({
    title:
      dataSource?.name ??
      titleFromRichText(dataSource?.title) ??
      databaseRef?.title ??
      'Notion data source',
    url: databaseRef?.url ?? notionUrlFromId(dataSourceId),
  });
  ctx.dataSourceRefsById.set(dataSourceId, ref);
  return ref;
}

export function titleFromPage(page: RawNotionPage): string | undefined {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type === 'title') {
      const title = titleFromRichText(property.title);
      if (title) {
        return title;
      }
    }
  }

  return undefined;
}

async function referenceForBlockParent(
  ctx: SyncContext,
  blockId: string,
): Promise<NotionReference> {
  let currentBlockId: string | undefined = blockId;

  for (let index = 0; index < MAX_BLOCK_PARENT_HOPS && currentBlockId; index += 1) {
    const block = await tryFetchBlock(ctx, currentBlockId);
    if (!block?.parent) {
      break;
    }

    if (block.parent.type === 'page_id' && block.parent.page_id) {
      return referenceForPageId(ctx, block.parent.page_id);
    }

    if (block.parent.type === 'data_source_id' && block.parent.data_source_id) {
      return referenceForDataSourceId(ctx, block.parent.data_source_id, block.parent.database_id);
    }

    if (block.parent.type === 'database_id' && block.parent.database_id) {
      return referenceForDatabaseId(ctx, block.parent.database_id);
    }

    currentBlockId = block.parent.type === 'block_id' ? block.parent.block_id : undefined;
  }

  return { title: 'Notion block', url: notionUrlFromId(blockId) };
}
