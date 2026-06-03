import { Elysia, StatusMap } from 'elysia';
import { BatchSaveBodySchema, BatchSaveResponseSchema } from '#routes/webhooks/batch-save/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

export const batchSaveController = new Elysia()
  .use(loggerPlugin('batchSaveController'))
  .use(RecordsServicePlugin)
  .post(
    '/webhooks/batch-save',
    async ({ body, recordsService, logger, status }) => {
      logger.info(`handling batch-save for ${body.nango_integration_id} ${body.model}`);
      const result = await recordsService.ingestBatch({
        nangoIntegrationId: body.nango_integration_id,
        connectionId: body.connection_id,
        model: body.model,
        externalIds: body.ids,
      });
      return status(StatusMap.OK, result);
    },
    {
      detail: { hide: true },
      body: BatchSaveBodySchema,
      response: {
        [StatusMap.OK]: BatchSaveResponseSchema,
      },
    },
  );
