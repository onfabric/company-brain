import { Elysia, StatusMap } from 'elysia';
import {
  knowledgePageAuth,
  REQUIRE_KNOWLEDGE_PAGE_AUTH_MACRO_NAME,
} from '#lib/browser-session-auth.ts';
import { KNOWLEDGE_HTML_HEADERS } from '#lib/knowledge-html.ts';
import { KnowledgeParamsSchema } from '#routes/knowledge/[id]/model.ts';
import { KnowledgeHtmlPageResponseSchema } from '#routes/knowledge/pages/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgePagesIdController = new Elysia()
  .use(loggerPlugin('knowledgePagesIdController'))
  .use(KnowledgeServicePlugin)
  .use(knowledgePageAuth)
  .get(
    '/knowledge/pages/:id',
    async ({ knowledgeService, logger, params, set, status }) => {
      logger.info(`fetching knowledge HTML page ${params.id}`);
      const html = await knowledgeService.getKnowledgeHtmlPage(params.id);
      Object.assign(set.headers, KNOWLEDGE_HTML_HEADERS);
      return status(StatusMap.OK, html);
    },
    {
      [REQUIRE_KNOWLEDGE_PAGE_AUTH_MACRO_NAME]: true,
      detail: {
        tags: ['Knowledge'],
        summary: 'Fetch a knowledge item as HTML',
        description:
          'Returns a sanitized, browser-navigable HTML representation of a knowledge item. Accepts either the API key header or a session cookie minted by POST /sessions.',
      },
      params: KnowledgeParamsSchema,
      response: {
        [StatusMap.OK]: KnowledgeHtmlPageResponseSchema,
      },
    },
  );
