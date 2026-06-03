import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import { MergePeopleBodySchema, MergePeopleResponseSchema } from '#routes/people/merge/model.ts';
import { loggerPlugin, PeopleServicePlugin } from '#services/plugins.ts';

export const peopleMergeController = new Elysia()
  .use(loggerPlugin('peopleMergeController'))
  .use(PeopleServicePlugin)
  .use(apiKeyAuth)
  .post(
    '/people/merge',
    async ({ body, peopleService, logger, status }) => {
      logger.info(`merging person ${body.merge_from_id} into ${body.merge_into_id}`);
      const result = await peopleService.mergePeople(body.merge_from_id, body.merge_into_id);
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      body: MergePeopleBodySchema,
      response: {
        [StatusMap.OK]: MergePeopleResponseSchema,
      },
    },
  );
