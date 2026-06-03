import { Elysia, StatusMap } from 'elysia';
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
  .get(
    '/people',
    async ({ query, peopleService, logger, status }) => {
      logger.info(`listing people is_external=${query.is_external ?? ''}`);
      const result = await peopleService.listPeople({ isExternal: query.is_external });
      return status(StatusMap.OK, result);
    },
    {
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
      params: UpdatePersonParamsSchema,
      body: UpdatePersonBodySchema,
      response: {
        [StatusMap.OK]: UpdatePersonResponseSchema,
      },
    },
  );
