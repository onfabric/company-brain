import { Elysia, StatusMap } from 'elysia';
import { isAllowedRedirectUri } from '#lib/dcr-registration.ts';
import { env } from '#lib/env.ts';
import { PUBLIC_CORS_MACRO_NAME, publicCors } from '#lib/public-cors.ts';
import {
  ClientRegistrationErrorSchema,
  ClientRegistrationRequestSchema,
  ClientRegistrationResponseSchema,
  NoContentResponseSchema,
} from '#routes/oidc/model.ts';

const DEFAULT_CLIENT_NAME = 'MCP client';

// Cosmetic RFC 7591 Dynamic Client Registration: Google has no DCR, so every
// MCP client is handed the brain's single pre-registered Google client_id. The
// brain mediates the rest of the flow (token exchange) on that one client's
// behalf, which is why the public clients can all share it.
export const oidcRegisterController = new Elysia()
  .use(publicCors)
  .post(
    '/oidc/register',
    ({ body, status }) => {
      if (!body.redirect_uris.every(isAllowedRedirectUri)) {
        return status(StatusMap['Bad Request'], {
          error: 'invalid_redirect_uri',
          error_description: 'redirect_uris must be https or loopback http URIs',
        });
      }
      const clientName = body.client_name || DEFAULT_CLIENT_NAME;
      return status(StatusMap.Created, {
        client_id: env.googleClientId,
        client_name: clientName,
        redirect_uris: body.redirect_uris,
        token_endpoint_auth_method: 'none' as const,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      });
    },
    {
      [PUBLIC_CORS_MACRO_NAME]: true,
      body: ClientRegistrationRequestSchema,
      response: {
        [StatusMap.Created]: ClientRegistrationResponseSchema,
        [StatusMap['Bad Request']]: ClientRegistrationErrorSchema,
      },
      detail: { hide: true },
    },
  )
  .options(
    '/oidc/register',
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
