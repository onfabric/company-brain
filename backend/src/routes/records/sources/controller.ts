import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import { ListSourcesResponseSchema } from '#routes/records/sources/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

export const recordsSourcesController = new Elysia()
  .use(loggerPlugin('recordsSourcesController'))
  .use(RecordsServicePlugin)
  .use(apiKeyAuth)
  .get(
    '/records/sources',
    async ({ recordsService, logger, status }) => {
      logger.info('listing record sources and models');
      const result = await recordsService.listSources();
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      detail: {
        tags: ['Records'],
        summary: 'List record sources',
        description:
          'Returns each data source that has ingested records, broken down by model with per-model counts and timestamps.',
      },
      response: {
        [StatusMap.OK]: ListSourcesResponseSchema,
      },
    },
  );
