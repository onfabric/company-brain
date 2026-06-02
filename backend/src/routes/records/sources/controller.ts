import { Elysia, StatusMap } from 'elysia';
import { ListSourcesResponseSchema } from '#routes/records/sources/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

export const recordsSourcesController = new Elysia()
  .use(loggerPlugin('recordsSourcesController'))
  .use(RecordsServicePlugin)
  .get(
    '/records/sources',
    async ({ recordsService, logger, status }) => {
      logger.info('listing record sources and models');
      const result = await recordsService.listSources();
      return status(StatusMap.OK, result);
    },
    {
      response: {
        [StatusMap.OK]: ListSourcesResponseSchema,
      },
    },
  );
