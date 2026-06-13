import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth/plugin.ts';
import { RecordParamsSchema, RecordResponseSchema } from '#routes/records/[id]/model.ts';
import { loggerPlugin, RecordsServicePlugin } from '#services/plugins.ts';

export const recordsIdController = new Elysia()
  .use(loggerPlugin('recordsIdController'))
  .use(RecordsServicePlugin)
  .use(authPlugin)
  .get(
    '/records/:id',
    async ({ params, recordsService, logger, status }) => {
      logger.info(`fetching record ${params.id}`);
      const record = await recordsService.getRecord(params.id);
      return status(StatusMap.OK, record);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
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
