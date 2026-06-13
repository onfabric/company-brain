import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth/plugin.ts';
import {
  CreateKnowledgeTypeBodySchema,
  KnowledgeTypeSchema,
  ListKnowledgeTypesResponseSchema,
} from '#routes/knowledge-types/model.ts';
import { KnowledgeTypesServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgeTypesController = new Elysia()
  .use(loggerPlugin('knowledgeTypesController'))
  .use(KnowledgeTypesServicePlugin)
  .use(authPlugin)
  .get(
    '/knowledge-types',
    async ({ knowledgeTypesService, logger, status }) => {
      logger.info('listing knowledge types');
      const knowledge_types = await knowledgeTypesService.list();
      return status(StatusMap.OK, { knowledge_types });
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['Knowledge Types'],
        summary: 'List knowledge types',
        description: 'Returns every knowledge type, ordered by name.',
      },
      response: {
        [StatusMap.OK]: ListKnowledgeTypesResponseSchema,
      },
    },
  )
  .post(
    '/knowledge-types',
    async ({ body, knowledgeTypesService, logger, status }) => {
      logger.info(`creating knowledge type ${body.name}`);
      const created = await knowledgeTypesService.create(body.name);
      return status(StatusMap.Created, created);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      parse: 'json',
      detail: {
        tags: ['Knowledge Types'],
        summary: 'Create a knowledge type',
        description: 'Creates a knowledge type. The name must be unique.',
      },
      body: CreateKnowledgeTypeBodySchema,
      response: {
        [StatusMap.Created]: KnowledgeTypeSchema,
      },
    },
  );
