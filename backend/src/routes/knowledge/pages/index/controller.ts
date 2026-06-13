import { Elysia, StatusMap } from 'elysia';
import { authMacro } from '#lib/auth-macro.ts';
import { KNOWLEDGE_HTML_HEADERS } from '#lib/knowledge-html.ts';
import { KnowledgeHtmlPageResponseSchema } from '#routes/knowledge/pages/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const knowledgePagesIndexController = new Elysia()
  .use(loggerPlugin('knowledgePagesIndexController'))
  .use(KnowledgeServicePlugin)
  .use(authMacro)
  .get(
    '/knowledge/pages/index',
    async ({ knowledgeService, logger, set, status }) => {
      logger.info('fetching knowledge HTML index page');
      const html = await knowledgeService.getKnowledgeIndexHtmlPage();
      set.headers = { ...KNOWLEDGE_HTML_HEADERS };
      return status(StatusMap.OK, html);
    },
    {
      auth: true,
      detail: {
        tags: ['Knowledge'],
        summary: 'Fetch the knowledge index as HTML',
        description:
          'Returns the canonical knowledge index page. Accepts either the API key header or a better-auth session cookie.',
      },
      response: {
        [StatusMap.OK]: KnowledgeHtmlPageResponseSchema,
      },
    },
  );
