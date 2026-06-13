import { Elysia, StatusMap, t } from 'elysia';
import { oauthBetterAuthProvider } from 'mcp-use/server';
import type { OpenAPIV3 } from 'openapi-types';
import {
  API_KEY_SECURITY_SCHEME,
  getHeader,
  hasValidApiKey,
  type RequestHeaders,
} from '#lib/api-key-auth.ts';
import { env } from '#lib/env.ts';

export const REQUIRE_MCP_AUTH_MACRO_NAME = 'requireMcpAuth';
export const MCP_BEARER_SECURITY_SCHEME = 'mcpBearer';
export const MCP_SCOPE = 'mcp';

export const mcpBearerSecuritySchemes = {
  [MCP_BEARER_SECURITY_SCHEME]: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: "Bearer JWT issued by the brain's own OAuth 2.1 authorization server",
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

const oauth = oauthBetterAuthProvider({ authURL: env.issuer });

const BEARER_PREFIX = 'Bearer ';

function bearerToken(headers: RequestHeaders): string | null {
  const authorization = getHeader(headers, 'Authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return authorization.slice(BEARER_PREFIX.length);
}

function hasMcpAudience(audience: unknown): boolean {
  const expected = env.mcpResource.href;
  return Array.isArray(audience) ? audience.includes(expected) : audience === expected;
}

// mcp-use's better-auth provider verifies the signature and issuer against the
// brain's JWKS; the audience is checked here so a token minted for a different
// resource can never reach `/mcp`.
async function hasValidMcpAccessToken(headers: RequestHeaders): Promise<boolean> {
  const token = bearerToken(headers);
  if (!token) {
    return false;
  }
  try {
    const { payload } = await oauth.verifyToken(token);
    return hasMcpAudience(payload.aud);
  } catch {
    return false;
  }
}

// RFC 9728 path-suffixed form: metadata for <origin>/mcp lives at
// <origin>/.well-known/oauth-protected-resource/mcp (served by mcp-use).
function protectedResourceMetadataUrl(): string {
  const { origin, pathname } = env.mcpResource;
  return `${origin}/.well-known/oauth-protected-resource${pathname}`;
}

// mcp-use only guards `/mcp/*`, never the bare `/mcp` endpoint, and never the
// brain's API-key fast path. This macro fronts `/mcp` with both: a valid brain
// API key, or a bearer access token verified through mcp-use's better-auth
// provider (the same provider the MCP server uses), otherwise an RFC 9728
// challenge pointing at the protected-resource metadata.
export const mcpAuth = new Elysia({ name: 'mcpAuth' }).macro(REQUIRE_MCP_AUTH_MACRO_NAME, {
  detail: {
    security: [{ [API_KEY_SECURITY_SCHEME]: [] }, { [MCP_BEARER_SECURITY_SCHEME]: [] }],
  },
  response: {
    [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
  },
  async beforeHandle({ headers, status, set }) {
    if (hasValidApiKey(headers)) {
      return;
    }
    if (await hasValidMcpAccessToken(headers)) {
      return;
    }
    set.headers['www-authenticate'] =
      `Bearer resource_metadata="${protectedResourceMetadataUrl()}", scope="${MCP_SCOPE}"`;
    return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
  },
});
