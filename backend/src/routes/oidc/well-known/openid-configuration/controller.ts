import { Elysia } from 'elysia';
import { LogtoDcrServicePlugin, loggerPlugin } from '#services/plugins.ts';

// OIDC discovery for the authorization server origin: the reverse proxy in
// front of Logto routes this path here so the document can advertise the
// registration_endpoint Logto itself lacks. Unauthenticated by design;
// access-control-allow-origin lets browser-based MCP clients read it.
export const oidcOpenidConfigurationController = new Elysia()
  .use(loggerPlugin('oidcOpenidConfigurationController'))
  .use(LogtoDcrServicePlugin)
  .get(
    '/oidc/.well-known/openid-configuration',
    async ({ logtoDcrService, set }) => {
      set.headers['access-control-allow-origin'] = '*';
      return await logtoDcrService.openidConfiguration();
    },
    { detail: { hide: true } },
  );
