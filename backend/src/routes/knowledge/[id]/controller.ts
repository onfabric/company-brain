import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import {
  KnowledgeItemResponseSchema,
  KnowledgeParamsSchema,
  UpdateKnowledgeBodySchema,
  UpdateKnowledgeResponseSchema,
} from '#routes/knowledge/[id]/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgeIdController = new Elysia()
  .use(loggerPlugin('knowledgeIdController'))
  .use(KnowledgeServicePlugin)
  .use(apiKeyAuth)
  .get(
    '/knowledge/:id',
    async ({ params, knowledgeService, logger, status }) => {
      logger.info(`fetching knowledge ${params.id}`);
      const knowledge = await knowledgeService.getKnowledge(params.id);
      return status(StatusMap.OK, knowledge);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
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
      [REQUIRE_API_KEY_MACRO_NAME]: true,
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
  );
