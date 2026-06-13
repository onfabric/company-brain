import { Elysia, StatusMap } from 'elysia';
import { brainAuth, REQUIRE_AUTH_MACRO_NAME } from '#lib/session-auth.ts';
import { RecordParamsSchema, RecordResponseSchema } from '#routes/records/[id]/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

export const recordsIdController = new Elysia()
  .use(loggerPlugin('recordsIdController'))
  .use(RecordsServicePlugin)
  .use(brainAuth)
  .get(
    '/records/:id',
    async ({ params, recordsService, logger, status }) => {
      logger.info(`fetching record ${params.id}`);
      const record = await recordsService.getRecord(params.id);
      return status(StatusMap.OK, record);
    },
    {
      [REQUIRE_AUTH_MACRO_NAME]: true,
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
