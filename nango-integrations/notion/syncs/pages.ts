import { createSync } from 'nango';

import { BatchWriter } from '../../syncs/batch-writer.js';
import {
  enqueueDatabaseDataSources,
  enqueueDataSourcePages,
  enqueueSearchResults,
  tryFetchPage,
} from './client.js';
import { type NangoLike, type SyncContext, WorkQueue } from './context.js';
import { MetadataSchema, type NotionPage, NotionPageSchema, type SyncMetadata } from './models.js';
import { buildPageRecord } from './record.js';
import { batchSize, parseOptional } from './utils.js';

const sync = createSync({
  description:
    'Sync flattened Notion page records with page/database references kept as links and expiring file URLs omitted',
  version: '1.0.0',
  endpoints: [{ method: 'POST', path: '/syncs/pages', group: 'Pages' }],
  frequency: 'every hour',
  autoStart: true,
  metadata: MetadataSchema,

  models: {
    NotionPage: NotionPageSchema,
  },

  exec: async (nango) => {
    const metadata = parseOptional(MetadataSchema, await nango.getMetadata());
    const ctx: SyncContext = {
      nango: nango as unknown as NangoLike,
      metadata,
      pageRefsById: new Map(),
      databaseRefsById: new Map(),
      dataSourceRefsById: new Map(),
      dataSourcesById: new Map(),
      databasesById: new Map(),
    };

    const pageQueue = new WorkQueue();
    const databaseQueue = new WorkQueue();
    const dataSourceQueue = new WorkQueue();
    const writer = new BatchWriter<NotionPage>({
      nango: ctx.nango,
      model: 'NotionPage',
      batchSize: batchSize(metadata),
      schema: NotionPageSchema,
    });
    let processedPages = 0;

    await enqueueSearchResults(ctx, pageQueue, dataSourceQueue);

    while (pageQueue.hasNext() || databaseQueue.hasNext() || dataSourceQueue.hasNext()) {
      while (dataSourceQueue.hasNext()) {
        await enqueueDataSourcePages(ctx, dataSourceQueue.next(), pageQueue, dataSourceQueue);
      }

      while (databaseQueue.hasNext()) {
        await enqueueDatabaseDataSources(ctx, databaseQueue.next(), dataSourceQueue);
      }

      if (!pageQueue.hasNext()) {
        continue;
      }

      if (
        typeof metadata?.maxPagesPerRun === 'number' &&
        processedPages >= metadata.maxPagesPerRun
      ) {
        break;
      }

      const page = await tryFetchPage(ctx, pageQueue.next());
      if (!page || shouldSkipPage(page, metadata)) {
        continue;
      }

      const result = await buildPageRecord(ctx, page);
      await writer.save(result.record);
      processedPages += 1;

      pageQueue.addMany(result.pageIds);
      databaseQueue.addMany(result.databaseIds);
      dataSourceQueue.addMany(result.dataSourceIds);
    }

    await writer.flush();
  },
});

function shouldSkipPage(
  page: { in_trash?: boolean; archived?: boolean },
  metadata: SyncMetadata | undefined,
): boolean {
  return !metadata?.includeTrashed && Boolean(page.in_trash ?? page.archived);
}

export type NangoSyncLocal = Parameters<(typeof sync)['exec']>[0];
export default sync;
