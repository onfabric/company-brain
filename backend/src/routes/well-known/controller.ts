import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { Elysia, type Static, StatusMap } from 'elysia';
import { AUTH_BASE_PATH, auth } from '#lib/auth.ts';
import { env } from '#lib/env.ts';
import { MCP_SCOPE } from '#lib/mcp-oauth.ts';
import { ProtectedResourceMetadataSchema } from '#routes/well-known/model.ts';

const CORS_HEADERS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET' };

// RFC 8414 / OpenID discovery. better-auth's basePath keeps these documents off
// the root, so its companion handlers re-serve them where MCP clients probe.
const authServerMetadata = oauthProviderAuthServerMetadata(auth, { headers: CORS_HEADERS });
const openIdConfigMetadata = oauthProviderOpenIdConfigMetadata(auth, { headers: CORS_HEADERS });

// RFC 9728 Protected Resource Metadata is the resource server's own
// responsibility; better-auth's authorization server does not serve it. MCP
// clients try the path-suffixed form (`.../mcp`) before the root.
const protectedResource: Static<typeof ProtectedResourceMetadataSchema> = {
  resource: env.mcpResource.href,
  authorization_servers: [env.issuer],
  scopes_supported: [MCP_SCOPE],
  bearer_methods_supported: ['header'],
};

export const wellKnownController = new Elysia()
  .get('/.well-known/oauth-authorization-server', ({ request }) => authServerMetadata(request), {
    detail: { hide: true },
  })
  .get(
    `${AUTH_BASE_PATH}/.well-known/oauth-authorization-server`,
    ({ request }) => authServerMetadata(request),
    { detail: { hide: true } },
  )
  .get('/.well-known/openid-configuration', ({ request }) => openIdConfigMetadata(request), {
    detail: { hide: true },
  })
  .get(
    `${AUTH_BASE_PATH}/.well-known/openid-configuration`,
    ({ request }) => openIdConfigMetadata(request),
    { detail: { hide: true } },
  )
  .get(
    '/.well-known/oauth-protected-resource/mcp',
    ({ set }) => {
      set.headers['access-control-allow-origin'] = CORS_HEADERS['access-control-allow-origin'];
      set.headers['access-control-allow-methods'] = CORS_HEADERS['access-control-allow-methods'];
      return protectedResource;
    },
    { response: { [StatusMap.OK]: ProtectedResourceMetadataSchema }, detail: { hide: true } },
  )
  .get(
    '/.well-known/oauth-protected-resource',
    ({ set }) => {
      set.headers['access-control-allow-origin'] = CORS_HEADERS['access-control-allow-origin'];
      set.headers['access-control-allow-methods'] = CORS_HEADERS['access-control-allow-methods'];
      return protectedResource;
    },
    { response: { [StatusMap.OK]: ProtectedResourceMetadataSchema }, detail: { hide: true } },
  );
