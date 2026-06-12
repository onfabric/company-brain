import { Elysia, StatusMap } from 'elysia';
import { isAllowedRedirectUri } from '#lib/dcr-registration.ts';
import {
  ClientRegistrationErrorSchema,
  ClientRegistrationRequestSchema,
  ClientRegistrationResponseSchema,
} from '#routes/oidc/model.ts';
import { LogtoDcrServicePlugin, loggerPlugin } from '#services/plugins.ts';

const DEFAULT_CLIENT_NAME = 'MCP client';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

// RFC 7591 Dynamic Client Registration. Reached on the authorization server
// origin: the reverse proxy in front of Logto routes /oidc/register here, and
// the discovery document we serve advertises it as the registration_endpoint.
export const oidcRegisterController = new Elysia()
  .use(loggerPlugin('oidcRegisterController'))
  .use(LogtoDcrServicePlugin)
  .post(
    '/oidc/register',
    async ({ body, logtoDcrService, set, status }) => {
      set.headers = { ...CORS_HEADERS };
      if (!body.redirect_uris.every(isAllowedRedirectUri)) {
        return status(StatusMap['Bad Request'], {
          error: 'invalid_redirect_uri',
          error_description: 'redirect_uris must be https or loopback http URIs',
        });
      }
      const clientName = body.client_name || DEFAULT_CLIENT_NAME;
      const redirectUris = body.redirect_uris;
      const clientId = await logtoDcrService.registerClient({ clientName, redirectUris });
      return status(StatusMap.Created, {
        client_id: clientId,
        client_name: clientName,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: 'none' as const,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      });
    },
    {
      body: ClientRegistrationRequestSchema,
      response: {
        [StatusMap.Created]: ClientRegistrationResponseSchema,
        [StatusMap['Bad Request']]: ClientRegistrationErrorSchema,
      },
      detail: { hide: true },
    },
  )
  .options('/oidc/register', ({ set }) => {
    set.headers = { ...CORS_HEADERS };
    return new Response(null, { status: StatusMap['No Content'] });
  });
