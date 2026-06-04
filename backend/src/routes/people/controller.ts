import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import { ListPeopleQuerySchema, ListPeopleResponseSchema } from '#routes/people/model.ts';
import { loggerPlugin, PeopleServicePlugin } from '#services/plugins.ts';

export const peopleController = new Elysia()
  .use(loggerPlugin('peopleController'))
  .use(PeopleServicePlugin)
  .use(apiKeyAuth)
  .get(
    '/people',
    async ({ query, peopleService, logger, status }) => {
      logger.info(
        `listing people is_external=${query.is_external ?? ''} sort=${query.sort_by ?? ''}:${query.sort_order ?? ''}`,
      );
      const result = await peopleService.listPeople({
        isExternal: query.is_external,
        sortBy: query.sort_by,
        sortOrder: query.sort_order,
      });
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      detail: {
        tags: ['People'],
        summary: 'List people',
        description:
          'Returns the people derived from ingested records, optionally filtered and sorted via query parameters.',
      },
      query: ListPeopleQuerySchema,
      response: {
        [StatusMap.OK]: ListPeopleResponseSchema,
      },
    },
  );
