import { Elysia, type Static, StatusMap } from 'elysia';
import { env } from '#lib/env.ts';
import { MCP_SCOPE } from '#lib/mcp-oauth.ts';
import { PUBLIC_CORS_MACRO_NAME, publicCors } from '#lib/public-cors.ts';
import { ProtectedResourceMetadataSchema } from '#routes/well-known/oauth-protected-resource/model.ts';

// RFC 9728 Protected Resource Metadata: how MCP clients discover the
// authorization server after a 401. `authorization_servers` points at the
// brain's own issuer. Served at both the root and the path-suffixed form
// (clients try `/.well-known/oauth-protected-resource/mcp` first). Unauthenticated.
const METADATA: Static<typeof ProtectedResourceMetadataSchema> = {
  resource: env.mcpResource.href,
  authorization_servers: [env.issuer],
  scopes_supported: [MCP_SCOPE],
  bearer_methods_supported: ['header'],
};

export const oauthProtectedResourceController = new Elysia()
  .use(publicCors)
  .get('/.well-known/oauth-protected-resource/mcp', () => METADATA, {
    [PUBLIC_CORS_MACRO_NAME]: true,
    response: { [StatusMap.OK]: ProtectedResourceMetadataSchema },
    detail: { hide: true },
  })
  .get('/.well-known/oauth-protected-resource', () => METADATA, {
    [PUBLIC_CORS_MACRO_NAME]: true,
    response: { [StatusMap.OK]: ProtectedResourceMetadataSchema },
    detail: { hide: true },
  });
