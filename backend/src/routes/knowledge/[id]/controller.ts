import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth-macro.ts';
import {
  DeleteKnowledgeResponseSchema,
  KnowledgeItemResponseSchema,
  KnowledgeParamsSchema,
  UpdateKnowledgeBodySchema,
  UpdateKnowledgeResponseSchema,
} from '#routes/knowledge/[id]/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgeIdController = new Elysia()
  .use(loggerPlugin('knowledgeIdController'))
  .use(KnowledgeServicePlugin)
  .use(authPlugin)
  .get(
    '/knowledge/:id',
    async ({ params, knowledgeService, logger, status }) => {
      logger.info(`fetching knowledge ${params.id}`);
      const knowledge = await knowledgeService.getKnowledge(params.id);
      return status(StatusMap.OK, knowledge);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['Knowledge'],
        summary: 'Fetch a single knowledge item',
        description: 'Returns a single distilled knowledge item by its id.',
      },
      params: KnowledgeParamsSchema,
      response: {
        [StatusMap.OK]: KnowledgeItemResponseSchema,
      },
    },
  )
  .patch(
    '/knowledge/:id',
    async ({ params, body, knowledgeService, logger, status }) => {
      logger.info(`updating knowledge ${params.id}`);
      const updated = await knowledgeService.update(params.id, body);
      return status(StatusMap.OK, updated);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      parse: 'json',
      detail: {
        tags: ['Knowledge'],
        summary: 'Update knowledge',
        description:
          'Updates a distilled knowledge item. Only the fields included in the request body are changed; person_ids and record_ids each replace the full set when present. Unknown referenced ids are rejected with 400.',
      },
      params: KnowledgeParamsSchema,
      body: UpdateKnowledgeBodySchema,
      response: {
        [StatusMap.OK]: UpdateKnowledgeResponseSchema,
      },
    },
  )
  .delete(
    '/knowledge/:id',
    async ({ params, knowledgeService, logger, status }) => {
      logger.info(`deleting knowledge ${params.id}`);
      const id = await knowledgeService.remove(params.id);
      return status(StatusMap.OK, { id });
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['Knowledge'],
        summary: 'Delete a knowledge item',
        description:
          'Deletes a distilled knowledge item by its id, along with its participant and source-record links. Returns 404 if no item with that id exists.',
      },
      params: KnowledgeParamsSchema,
      response: {
        [StatusMap.OK]: DeleteKnowledgeResponseSchema,
      },
    },
  );
