import { Elysia } from 'elysia';
import { env } from '#lib/env.ts';
import { MCP_SCOPE } from '#lib/mcp-oauth.ts';
import { PUBLIC_CORS_MACRO_NAME, publicCors } from '#lib/public-cors.ts';

// RFC 9728 Protected Resource Metadata: how MCP clients discover the
// authorization server after a 401. Served at both the root and the
// path-suffixed form (clients try `/.well-known/oauth-protected-resource/mcp`
// first for the resource `<origin>/mcp`). Unauthenticated by design.
function metadata() {
  return {
    resource: env.mcpResource,
    authorization_servers: [env.mcpOauthIssuer],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
  };
}

const ROUTE_OPTIONS = { [PUBLIC_CORS_MACRO_NAME]: true, detail: { hide: true } } as const;

export const oauthProtectedResourceController = new Elysia()
  .use(publicCors)
  .get('/.well-known/oauth-protected-resource/mcp', metadata, ROUTE_OPTIONS)
  .get('/.well-known/oauth-protected-resource', metadata, ROUTE_OPTIONS);
