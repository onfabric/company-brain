import { Elysia, StatusMap } from 'elysia';
import { brainAuth, REQUIRE_AUTH_MACRO_NAME } from '#lib/session-auth.ts';
import {
  GetPersonResponseSchema,
  PersonParamsSchema,
  UpdatePersonBodySchema,
  UpdatePersonParamsSchema,
  UpdatePersonResponseSchema,
} from '#routes/people/[id]/model.ts';
import { loggerPlugin, PeopleServicePlugin } from '#services/plugins.ts';

export const peopleIdController = new Elysia()
  .use(loggerPlugin('peopleIdController'))
  .use(PeopleServicePlugin)
  .use(brainAuth)
  .get(
    '/people/:id',
    async ({ params, peopleService, logger, status }) => {
      logger.info(`getting person ${params.id}`);
      const person = await peopleService.getPerson(params.id);
      return status(StatusMap.OK, person);
    },
    {
      [REQUIRE_AUTH_MACRO_NAME]: true,
      detail: {
        tags: ['People'],
        summary: 'Get a person',
        description: 'Returns a single person by id, including data sources and record count.',
      },
      params: PersonParamsSchema,
      response: {
        [StatusMap.OK]: GetPersonResponseSchema,
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
      [REQUIRE_AUTH_MACRO_NAME]: true,
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
