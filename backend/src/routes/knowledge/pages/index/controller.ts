import { Elysia, StatusMap, t } from 'elysia';
import { hasValidKnowledgePageAuth } from '#lib/browser-session-auth.ts';
import { KNOWLEDGE_HTML_HEADERS } from '#lib/knowledge-html.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgePagesIndexController = new Elysia()
  .use(loggerPlugin('knowledgePagesIndexController'))
  .use(KnowledgeServicePlugin)
  .get(
    '/knowledge/pages/index',
    async ({ headers, knowledgeService, logger }) => {
      if (!hasValidKnowledgePageAuth(headers)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: StatusMap.Unauthorized,
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        });
      }

      logger.info('fetching knowledge HTML index page');
      const html = await knowledgeService.getKnowledgeIndexHtmlPage();
      return new Response(html, {
        status: StatusMap.OK,
        headers: KNOWLEDGE_HTML_HEADERS,
      });
    },
    {
      detail: {
        tags: ['Knowledge'],
        summary: 'Fetch the knowledge index as HTML',
        description:
          'Returns the canonical knowledge index page. Accepts either the API key header or a session cookie minted by POST /sessions.',
      },
      response: {
        [StatusMap.OK]: t.String(),
        [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
      },
    },
  );
