import type { Context } from 'elysia';
import { Elysia, StatusMap } from 'elysia';
import { mcpOauthEnv } from '#lib/env.ts';
import { MCP_SCOPE } from '#lib/mcp-oauth.ts';

// RFC 9728 Protected Resource Metadata: how MCP clients discover the
// authorization server after a 401. Served at both the root and the
// path-suffixed form (clients try `/.well-known/oauth-protected-resource/mcp`
// first for the resource `<origin>/mcp`). Unauthenticated by design;
// `access-control-allow-origin: *` lets browser-based MCP clients read it.
function metadata({ set, status }: Pick<Context, 'set' | 'status'>) {
  const config = mcpOauthEnv();
  if (!config) {
    return status(StatusMap['Not Found'], { error: 'Not Found' });
  }
  set.headers['access-control-allow-origin'] = '*';
  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
  };
}

export const oauthProtectedResourceController = new Elysia()
  .get('/.well-known/oauth-protected-resource/mcp', metadata, { detail: { hide: true } })
  .get('/.well-known/oauth-protected-resource', metadata, { detail: { hide: true } });
