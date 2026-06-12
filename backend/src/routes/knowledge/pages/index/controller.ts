import { Elysia, StatusMap } from 'elysia';
import {
  knowledgePageAuth,
  REQUIRE_KNOWLEDGE_PAGE_AUTH_MACRO_NAME,
} from '#lib/browser-session-auth.ts';
import { KNOWLEDGE_HTML_HEADERS } from '#lib/knowledge-html.ts';
import { KnowledgeHtmlPageResponseSchema } from '#routes/knowledge/pages/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgePagesIndexController = new Elysia()
  .use(loggerPlugin('knowledgePagesIndexController'))
  .use(KnowledgeServicePlugin)
  .use(knowledgePageAuth)
  .get(
    '/knowledge/pages/index',
    async ({ knowledgeService, logger, set, status }) => {
      logger.info('fetching knowledge HTML index page');
      const html = await knowledgeService.getKnowledgeIndexHtmlPage();
      Object.assign(set.headers, KNOWLEDGE_HTML_HEADERS);
      return status(StatusMap.OK, html);
    },
    {
      [REQUIRE_KNOWLEDGE_PAGE_AUTH_MACRO_NAME]: true,
      detail: {
        tags: ['Knowledge'],
        summary: 'Fetch the knowledge index as HTML',
        description:
          'Returns the canonical knowledge index page. Accepts either the API key header or a session cookie minted by POST /sessions.',
      },
      response: {
        [StatusMap.OK]: KnowledgeHtmlPageResponseSchema,
      },
    },
  );
