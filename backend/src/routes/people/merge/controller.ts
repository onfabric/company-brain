import { Elysia, StatusMap } from 'elysia';
import { MergePeopleBodySchema, MergePeopleResponseSchema } from '#routes/people/merge/model.ts';
import { loggerPlugin, PeopleServicePlugin } from '#services/plugins.ts';

export const peopleMergeController = new Elysia()
  .use(loggerPlugin('peopleMergeController'))
  .use(PeopleServicePlugin)
  .post(
    '/people/merge',
    async ({ body, peopleService, logger, status }) => {
      logger.info(`merging person ${body.merge_from_id} into ${body.merge_into_id}`);
      const result = await peopleService.mergePeople(body.merge_from_id, body.merge_into_id);
      return status(StatusMap.OK, result);
    },
    {
      body: MergePeopleBodySchema,
      response: {
        [StatusMap.OK]: MergePeopleResponseSchema,
      },
    },
  );
