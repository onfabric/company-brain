import { Elysia, StatusMap } from 'elysia';
import { brainAuth, REQUIRE_AUTH_MACRO_NAME } from '#lib/session-auth.ts';
import { ListSourcesResponseSchema } from '#routes/data-sources/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

export const dataSourcesController = new Elysia()
  .use(loggerPlugin('dataSourcesController'))
  .use(RecordsServicePlugin)
  .use(brainAuth)
  .get(
    '/data-sources',
    async ({ recordsService, logger, status }) => {
      logger.info('listing data sources');
      const result = await recordsService.listSources();
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_AUTH_MACRO_NAME]: true,
      detail: {
        tags: ['Data Sources'],
        summary: 'List data sources',
        description: 'Returns each data source that has ingested records.',
      },
      response: {
        [StatusMap.OK]: ListSourcesResponseSchema,
      },
    },
  );
