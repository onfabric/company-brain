import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth-macro.ts';
import { KNOWLEDGE_HTML_HEADERS } from '#lib/knowledge-html.ts';
import { KnowledgeParamsSchema } from '#routes/knowledge/[id]/model.ts';
import { KnowledgeHtmlPageResponseSchema } from '#routes/knowledge/pages/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgePagesIdController = new Elysia()
  .use(loggerPlugin('knowledgePagesIdController'))
  .use(KnowledgeServicePlugin)
  .use(authPlugin)
  .get(
    '/knowledge/pages/:id',
    async ({ knowledgeService, logger, params, set, status }) => {
      logger.info(`fetching knowledge HTML page ${params.id}`);
      const html = await knowledgeService.getKnowledgeHtmlPage(params.id);
      set.headers = { ...KNOWLEDGE_HTML_HEADERS };
      return status(StatusMap.OK, html);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['Knowledge'],
        summary: 'Fetch a knowledge item as HTML',
        description:
          'Returns a sanitized, browser-navigable HTML representation of a knowledge item. Accepts either the API key header or a better-auth session cookie.',
      },
      params: KnowledgeParamsSchema,
      response: {
        [StatusMap.OK]: KnowledgeHtmlPageResponseSchema,
      },
    },
  );
