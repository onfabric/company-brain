import { Elysia, StatusMap } from 'elysia';
import { authMacro } from '#lib/auth-macro.ts';
import { MergePeopleBodySchema, MergePeopleResponseSchema } from '#routes/people/merge/model.ts';
import { loggerPlugin, PeopleServicePlugin } from '#services/plugins.ts';

export const peopleMergeController = new Elysia()
  .use(loggerPlugin('peopleMergeController'))
  .use(PeopleServicePlugin)
  .use(authMacro)
  .post(
    '/people/merge',
    async ({ body, peopleService, logger, status }) => {
      logger.info(`merging person ${body.merge_from_id} into ${body.merge_into_id}`);
      const result = await peopleService.mergePeople(body.merge_from_id, body.merge_into_id);
      return status(StatusMap.OK, result);
    },
    {
      auth: true,
      parse: 'json',
      detail: {
        tags: ['People'],
        summary: 'Merge two people',
        description:
          'Merges one person into another, moving the source person’s data sources and records onto the target and deleting the source.',
      },
      body: MergePeopleBodySchema,
      response: {
        [StatusMap.OK]: MergePeopleResponseSchema,
      },
    },
  );
