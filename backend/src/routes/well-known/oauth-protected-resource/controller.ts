import type { Context } from 'elysia';
import { Elysia } from 'elysia';
import { env } from '#lib/env.ts';
import { MCP_SCOPE } from '#lib/mcp-oauth.ts';

// RFC 9728 Protected Resource Metadata: how MCP clients discover the
// authorization server after a 401. Served at both the root and the
// path-suffixed form (clients try `/.well-known/oauth-protected-resource/mcp`
// first for the resource `<origin>/mcp`). Unauthenticated by design;
// `access-control-allow-origin: *` lets browser-based MCP clients read it.
function metadata({ set }: Pick<Context, 'set'>) {
  set.headers['access-control-allow-origin'] = '*';
  return {
    resource: env.mcpResource,
    authorization_servers: [env.mcpOauthIssuer],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
  };
}

export const oauthProtectedResourceController = new Elysia()
  .get('/.well-known/oauth-protected-resource/mcp', metadata, { detail: { hide: true } })
  .get('/.well-known/oauth-protected-resource', metadata, { detail: { hide: true } });
