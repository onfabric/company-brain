import { Elysia } from 'elysia';
import { PUBLIC_CORS_MACRO_NAME, publicCors } from '#lib/public-cors.ts';
import { LogtoDcrServicePlugin, loggerPlugin } from '#services/plugins.ts';

// OIDC discovery for the authorization server origin: the reverse proxy in
// front of Logto routes this path here so the document can advertise the
// registration_endpoint Logto itself lacks. Unauthenticated by design.
export const oidcOpenidConfigurationController = new Elysia()
  .use(loggerPlugin('oidcOpenidConfigurationController'))
  .use(LogtoDcrServicePlugin)
  .use(publicCors)
  .get(
    '/oidc/.well-known/openid-configuration',
    async ({ logtoDcrService }) => await logtoDcrService.openidConfiguration(),
    { [PUBLIC_CORS_MACRO_NAME]: true, detail: { hide: true } },
  );
