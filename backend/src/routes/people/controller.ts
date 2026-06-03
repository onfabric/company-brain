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
      params: UpdatePersonParamsSchema,
      body: UpdatePersonBodySchema,
      response: {
        [StatusMap.OK]: UpdatePersonResponseSchema,
      },
    },
  );
