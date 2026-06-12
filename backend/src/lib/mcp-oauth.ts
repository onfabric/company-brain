import { Elysia, StatusMap, t } from 'elysia';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { OpenAPIV3 } from 'openapi-types';
import {
  API_KEY_SECURITY_SCHEME,
  getHeader,
  hasValidApiKey,
  type RequestHeaders,
} from '#lib/api-key-auth.ts';
import { mcpOauthEnv } from '#lib/env.ts';

export const REQUIRE_MCP_AUTH_MACRO_NAME = 'requireMcpAuth';
export const MCP_BEARER_SECURITY_SCHEME = 'mcpBearer';
export const MCP_SCOPE = 'mcp';

export const mcpBearerSecuritySchemes = {
  [MCP_BEARER_SECURITY_SCHEME]: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'OAuth 2.1 access token issued by the company-brain Keycloak realm',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

type Jwks = ReturnType<typeof createRemoteJWKSet>;
const jwksByUrl = new Map<string, Jwks>();

function jwks(url: string): Jwks {
  let keySet = jwksByUrl.get(url);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(url));
    jwksByUrl.set(url, keySet);
  }
  return keySet;
}

export async function hasValidMcpAccessToken(headers: RequestHeaders): Promise<boolean> {
  const config = mcpOauthEnv();
  if (!config) {
    return false;
  }
  const authorization = getHeader(headers, 'Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }
  try {
    await jwtVerify(authorization.slice('Bearer '.length), jwks(config.jwksUrl), {
      issuer: config.issuer,
      audience: config.resource,
    });
    return true;
  } catch {
    return false;
  }
}

// RFC 9728 path-suffixed form: metadata for <origin>/mcp lives at
// <origin>/.well-known/oauth-protected-resource/mcp.
export function protectedResourceMetadataUrl(resource: string): string {
  const url = new URL(resource);
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
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
    const config = mcpOauthEnv();
    if (config) {
      set.headers['www-authenticate'] =
        `Bearer resource_metadata="${protectedResourceMetadataUrl(config.resource)}", scope="${MCP_SCOPE}"`;
    }
    return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
  },
});
