import { Elysia, StatusMap } from 'elysia';
import { env } from '#lib/env.ts';
import { PUBLIC_CORS_MACRO_NAME, publicCors } from '#lib/public-cors.ts';
import {
  NoContentResponseSchema,
  TokenErrorSchema,
  TokenRequestSchema,
  TokenResponseSchema,
} from '#routes/oidc/model.ts';

// The proxied token endpoint. The public MCP client posts its
// authorization_code (+ PKCE code_verifier) or refresh_token here; the brain
// injects the Google client_id/client_secret it cannot hold and forwards to
// Google, returning Google's token response verbatim.
export const tokenController = new Elysia()
  .use(publicCors)
  .post(
    '/token',
    async ({ body, status }) => {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          form.set(key, value);
        }
      }
      form.set('client_id', env.googleClientId);
      form.set('client_secret', env.googleClientSecret);

      const googleResponse = await fetch(env.googleTokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: form,
      });

      const payload = (await googleResponse.json()) as Record<string, unknown>;
      if (!googleResponse.ok) {
        const code =
          googleResponse.status === StatusMap.Unauthorized
            ? StatusMap.Unauthorized
            : StatusMap['Bad Request'];
        return status(code, {
          error: typeof payload.error === 'string' ? payload.error : 'invalid_request',
          ...payload,
        });
      }
      return status(StatusMap.OK, payload as { access_token: string });
    },
    {
      [PUBLIC_CORS_MACRO_NAME]: true,
      body: TokenRequestSchema,
      response: {
        [StatusMap.OK]: TokenResponseSchema,
        [StatusMap['Bad Request']]: TokenErrorSchema,
        [StatusMap.Unauthorized]: TokenErrorSchema,
      },
      detail: { hide: true },
    },
  )
  .options(
    '/token',
    ({ set, status }) => {
      set.headers['access-control-allow-methods'] = 'POST, OPTIONS';
      set.headers['access-control-allow-headers'] = 'content-type';
      return status(StatusMap['No Content'], undefined);
    },
    {
      [PUBLIC_CORS_MACRO_NAME]: true,
      response: { [StatusMap['No Content']]: NoContentResponseSchema },
      detail: { hide: true },
    },
  );
