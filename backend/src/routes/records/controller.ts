import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import {
  RecordParamsSchema,
  RecordResponseSchema,
  RecordsQuerySchema,
  RecordsResponseSchema,
} from '#routes/records/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export const recordsController = new Elysia()
  .use(loggerPlugin('recordsController'))
  .use(RecordsServicePlugin)
  .use(apiKeyAuth)
  .get(
    '/records',
    async ({ query, recordsService, logger, status }) => {
      logger.info(
        `searching records: q=${query.q ?? ''} source=${query.data_source_id ?? ''} people=${query.person_id?.length ?? 0}`,
      );
      const result = await recordsService.search({
        query: query.q,
        dataSourceId: query.data_source_id,
        personIds: query.person_id,
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
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      detail: {
        tags: ['Records'],
        summary: 'List and search records',
        description:
          'Full-text search over ingested records, with optional filtering by data source, person, and time range. Omit the query to list records matching the filters. Results are paginated.',
      },
      query: RecordsQuerySchema,
      response: {
        [StatusMap.OK]: RecordsResponseSchema,
      },
    },
  )
  .get(
    '/records/:id',
    async ({ params, recordsService, logger, status }) => {
      logger.info(`fetching record ${params.id}`);
      const record = await recordsService.getRecord(params.id);
      return status(StatusMap.OK, record);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      detail: {
        tags: ['Records'],
        summary: 'Fetch a single record',
        description: 'Returns a single ingested record by its id.',
      },
      params: RecordParamsSchema,
      response: {
        [StatusMap.OK]: RecordResponseSchema,
      },
    },
  );
