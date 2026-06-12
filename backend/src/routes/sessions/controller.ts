import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import {
  BRAIN_SESSION_COOKIE,
  BrainSessionCookieSchema,
  brainSessionCookieAttributes,
  createBrainSessionToken,
  isSecureCookieRequest,
} from '#lib/browser-session-auth.ts';
import { CreateSessionResponseSchema } from '#routes/sessions/model.ts';
import { loggerPlugin } from '#services/plugins.ts';

export const sessionsController = new Elysia()
  .use(loggerPlugin('sessionsController'))
  .use(apiKeyAuth)
  .post(
    '/sessions',
    ({ cookie, headers, logger, request, status }) => {
      logger.info('creating browser session');
      cookie[BRAIN_SESSION_COOKIE].set({
        value: createBrainSessionToken(),
        ...brainSessionCookieAttributes(isSecureCookieRequest(headers, request.url)),
      });
      return status(StatusMap['No Content'], undefined);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      cookie: BrainSessionCookieSchema,
      detail: {
        tags: ['Sessions'],
        summary: 'Create a browser session',
        description:
          'Exchanges a valid API key header for an HttpOnly browser session cookie scoped to navigable knowledge HTML pages.',
      },
      response: {
        [StatusMap['No Content']]: CreateSessionResponseSchema,
      },
    },
  );
