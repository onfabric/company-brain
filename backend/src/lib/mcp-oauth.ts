import { Elysia, StatusMap, t } from 'elysia';
import { createRemoteJWKSet, jwtVerify } from 'jose';
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
    description: 'OAuth 2.1 access token issued by the MCP authorization server',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

const jwks = createRemoteJWKSet(env.mcpOauthJwksUrl);

const BEARER_PREFIX = 'Bearer ';

function bearerToken(headers: RequestHeaders): string | null {
  const authorization = getHeader(headers, 'Authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return authorization.slice(BEARER_PREFIX.length);
}

export async function hasValidMcpAccessToken(headers: RequestHeaders): Promise<boolean> {
  const token = bearerToken(headers);
  if (!token) {
    return false;
  }
  try {
    await jwtVerify(token, jwks, {
      issuer: env.mcpOauthIssuer,
      audience: env.mcpResource.href,
    });
    return true;
  } catch {
    return false;
  }
}

// RFC 9728 path-suffixed form: metadata for <origin>/mcp lives at
// <origin>/.well-known/oauth-protected-resource/mcp.
export function protectedResourceMetadataUrl(): string {
  const { origin, pathname } = env.mcpResource;
  return `${origin}/.well-known/oauth-protected-resource${pathname}`;
}

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
