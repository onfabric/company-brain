import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import {
  KnowledgeItemResponseSchema,
  KnowledgeParamsSchema,
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
  );
