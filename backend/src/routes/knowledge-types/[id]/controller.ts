import { Elysia, StatusMap } from 'elysia';
import { authMacro } from '#lib/auth-macro.ts';
import {
  DeleteKnowledgeTypeResponseSchema,
  KnowledgeTypeParamsSchema,
  KnowledgeTypeResponseSchema,
  UpdateKnowledgeTypeBodySchema,
} from '#routes/knowledge-types/[id]/model.ts';
import { KnowledgeTypesServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgeTypesIdController = new Elysia()
  .use(loggerPlugin('knowledgeTypesIdController'))
  .use(KnowledgeTypesServicePlugin)
  .use(authMacro)
  .patch(
    '/knowledge-types/:id',
    async ({ params, body, knowledgeTypesService, logger, status }) => {
      logger.info(`updating knowledge type ${params.id}`);
      const updated = await knowledgeTypesService.update(params.id, body.name);
      return status(StatusMap.OK, updated);
    },
    {
      auth: true,
      parse: 'json',
      detail: {
        tags: ['Knowledge Types'],
        summary: 'Rename a knowledge type',
        description: 'Updates a knowledge type’s name. The new name must be unique.',
      },
      params: KnowledgeTypeParamsSchema,
      body: UpdateKnowledgeTypeBodySchema,
      response: {
        [StatusMap.OK]: KnowledgeTypeResponseSchema,
      },
    },
  )
  .delete(
    '/knowledge-types/:id',
    async ({ params, knowledgeTypesService, logger, status }) => {
      logger.info(`deleting knowledge type ${params.id}`);
      const id = await knowledgeTypesService.remove(params.id);
      return status(StatusMap.OK, { id });
    },
    {
      auth: true,
      detail: {
        tags: ['Knowledge Types'],
        summary: 'Delete a knowledge type',
        description:
          'Deletes a knowledge type. Fails with 409 if any knowledge still references it.',
      },
      params: KnowledgeTypeParamsSchema,
      response: {
        [StatusMap.OK]: DeleteKnowledgeTypeResponseSchema,
      },
    },
  );
