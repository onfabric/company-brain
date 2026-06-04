import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import {
  ListPeopleQuerySchema,
  ListPeopleResponseSchema,
  UpdatePersonBodySchema,
  UpdatePersonParamsSchema,
  UpdatePersonResponseSchema,
} from '#routes/people/model.ts';
import { loggerPlugin, PeopleServicePlugin } from '#services/plugins.ts';

export const peopleController = new Elysia()
  .use(loggerPlugin('peopleController'))
  .use(PeopleServicePlugin)
  .use(apiKeyAuth)
  .get(
    '/people',
    async ({ query, peopleService, logger, status }) => {
      logger.info(`listing people is_external=${query.is_external ?? ''}`);
      const result = await peopleService.listPeople({ isExternal: query.is_external });
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      detail: {
        tags: ['People'],
        summary: 'List people',
        description:
          'Returns the people derived from ingested records, optionally filtered by whether they are external to the company.',
      },
      query: ListPeopleQuerySchema,
      response: {
        [StatusMap.OK]: ListPeopleResponseSchema,
      },
    },
  )
  .patch(
    '/people/:id',
    async ({ params, body, peopleService, logger, status }) => {
      logger.info(`updating person ${params.id}`);
      const person = await peopleService.updatePerson(params.id, body);
      return status(StatusMap.OK, person);
    },
    {
      requireApiKey: true,
      parse: 'json',
      detail: {
        tags: ['People'],
        summary: 'Update a person',
        description:
          'Updates a person’s editable fields. Only the fields included in the request body are changed.',
      },
      params: UpdatePersonParamsSchema,
      body: UpdatePersonBodySchema,
      response: {
        [StatusMap.OK]: UpdatePersonResponseSchema,
      },
    },
  );
