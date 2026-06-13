import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth/plugin.ts';
import { RecordsQuerySchema, RecordsResponseSchema } from '#routes/records/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export const recordsController = new Elysia()
  .use(loggerPlugin('recordsController'))
  .use(RecordsServicePlugin)
  .use(authPlugin)
  .get(
    '/records',
    async ({ query, recordsService, logger, status }) => {
      logger.info(
        `searching records: q=${query.q ?? ''} source=${query.data_source_id ?? ''} people=${query.person_id?.length ?? 0} sort=${query.sort_by ?? ''}:${query.sort_order ?? ''}`,
      );
      const result = await recordsService.search({
        query: query.q,
        dataSourceId: query.data_source_id,
        personIds: query.person_id,
        createdAfter: query.created_after,
        createdBefore: query.created_before,
        updatedAfter: query.updated_after,
        updatedBefore: query.updated_before,
        sortBy: query.sort_by,
        sortOrder: query.sort_order,
        limit: query.limit ?? DEFAULT_LIMIT,
        offset: query.offset ?? DEFAULT_OFFSET,
      });
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['Records'],
        summary: 'List and search records',
        description:
          'Full-text search over ingested records, with optional filtering via query parameters. Omit the query to list records matching the filters. Results are paginated.',
      },
      query: RecordsQuerySchema,
      response: {
        [StatusMap.OK]: RecordsResponseSchema,
      },
    },
  );
