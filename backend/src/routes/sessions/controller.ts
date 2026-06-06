import { Elysia, StatusMap, t } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import { createBrainSessionSetCookie, isSecureCookieRequest } from '#lib/browser-session-auth.ts';
import { loggerPlugin } from '#services/plugins.ts';

export const sessionsController = new Elysia()
  .use(loggerPlugin('sessionsController'))
  .use(apiKeyAuth)
  .post(
    '/sessions',
    ({ headers, logger, request }) => {
      logger.info('creating browser session');
      return new Response(null, {
        status: StatusMap['No Content'],
        headers: {
          'set-cookie': createBrainSessionSetCookie({
            secure: isSecureCookieRequest(headers, request.url),
          }),
        },
      });
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      detail: {
        tags: ['Sessions'],
        summary: 'Create a browser session',
        description:
          'Exchanges a valid API key header for an HttpOnly browser session cookie scoped to navigable knowledge HTML pages.',
      },
      response: {
        [StatusMap['No Content']]: t.Void(),
      },
    },
  );
