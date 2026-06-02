import { Elysia, StatusMap } from 'elysia';
import { SearchQuerySchema, SearchResponseSchema } from '#routes/records/search/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export const recordsSearchController = new Elysia()
  .use(loggerPlugin('recordsSearchController'))
  .use(RecordsServicePlugin)
  .get(
    '/records/search',
    async ({ query, recordsService, logger, status }) => {
      logger.info(`searching records: q=${query.q ?? ''} source=${query.data_source_id ?? ''}`);
      const result = await recordsService.search({
        query: query.q,
        dataSourceId: query.data_source_id,
        model: query.model,
        createdAfter: query.created_after,
        createdBefore: query.created_before,
        updatedAfter: query.updated_after,
        updatedBefore: query.updated_before,
        limit: query.limit ?? DEFAULT_LIMIT,
        offset: query.offset ?? DEFAULT_OFFSET,
      });
      return status(StatusMap.OK, result);
    },
    {
      query: SearchQuerySchema,
      response: {
        [StatusMap.OK]: SearchResponseSchema,
      },
    },
  );
