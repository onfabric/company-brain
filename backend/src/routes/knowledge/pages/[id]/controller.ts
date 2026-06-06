import { Elysia, StatusMap, t } from 'elysia';
import { hasValidKnowledgePageAuth } from '#lib/browser-session-auth.ts';
import { KNOWLEDGE_HTML_HEADERS } from '#lib/knowledge-html.ts';
import { KnowledgeParamsSchema } from '#routes/knowledge/[id]/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgePagesIdController = new Elysia()
  .use(loggerPlugin('knowledgePagesIdController'))
  .use(KnowledgeServicePlugin)
  .get(
    '/knowledge/pages/:id',
    async ({ headers, knowledgeService, logger, params }) => {
      if (!hasValidKnowledgePageAuth(headers)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: StatusMap.Unauthorized,
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        });
      }

      logger.info(`fetching knowledge HTML page ${params.id}`);
      const html = await knowledgeService.getKnowledgeHtmlPage(params.id);
      return new Response(html, {
        status: StatusMap.OK,
        headers: KNOWLEDGE_HTML_HEADERS,
      });
    },
    {
      detail: {
        tags: ['Knowledge'],
        summary: 'Fetch a knowledge item as HTML',
        description:
          'Returns a sanitized, browser-navigable HTML representation of a knowledge item. Accepts either the API key header or a session cookie minted by POST /sessions.',
      },
      params: KnowledgeParamsSchema,
      response: {
        [StatusMap.OK]: t.String(),
        [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
      },
    },
  );
