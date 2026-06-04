import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
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
  .use(apiKeyAuth)
  .get(
    '/people/:id',
    async ({ params, peopleService, logger, status }) => {
      logger.info(`getting person ${params.id}`);
      const person = await peopleService.getPerson(params.id);
      return status(StatusMap.OK, person);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
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
