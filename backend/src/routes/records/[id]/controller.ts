import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import { RecordParamsSchema, RecordResponseSchema } from '#routes/records/[id]/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

export const recordsIdController = new Elysia()
  .use(loggerPlugin('recordsIdController'))
  .use(RecordsServicePlugin)
  .use(apiKeyAuth)
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
