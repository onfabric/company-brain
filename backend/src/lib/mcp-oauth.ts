import { Elysia, StatusMap, t } from 'elysia';
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
    description: 'Google OAuth 2.0 access token issued through the brain OAuth proxy',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

const BEARER_PREFIX = 'Bearer ';

function bearerToken(headers: RequestHeaders): string | null {
  const authorization = getHeader(headers, 'Authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return authorization.slice(BEARER_PREFIX.length);
}

// Google access tokens are opaque (not JWTs), so they can't be JWKS-verified.
// They are validated by calling Google's tokeninfo endpoint, which returns the
// token's audience (the OAuth client it was minted for), expiry, and — for a
// Workspace login — the hosted domain / email. A short positive cache keeps
// this to roughly one network round-trip per token per TTL window.
type TokenInfo = {
  aud?: string;
  azp?: string;
  exp?: string;
  email?: string;
  hd?: string;
  error?: string;
};

const MILLISECONDS_PER_SECOND = 1000;
const TOKEN_CACHE_TTL_SECONDS = 300;
const TOKEN_CACHE_TTL_MS = TOKEN_CACHE_TTL_SECONDS * MILLISECONDS_PER_SECOND;
const tokenCache = new Map<string, { validUntil: number }>();

function emailDomain(email: string | undefined): string | null {
  const at = email?.lastIndexOf('@') ?? -1;
  return at >= 0 ? (email as string).slice(at + 1) : null;
}

function isAllowedWorkspace(info: TokenInfo): boolean {
  const domain = info.hd ?? emailDomain(info.email);
  return domain === env.googleWorkspaceDomain;
}

function isOurClient(info: TokenInfo): boolean {
  return info.aud === env.googleClientId || info.azp === env.googleClientId;
}

async function fetchTokenInfo(token: string): Promise<TokenInfo | null> {
  const url = new URL(env.googleTokeninfoEndpoint);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as TokenInfo;
}

export async function hasValidMcpAccessToken(headers: RequestHeaders): Promise<boolean> {
  const token = bearerToken(headers);
  if (!token) {
    return false;
  }
  const cached = tokenCache.get(token);
  if (cached && cached.validUntil > Date.now()) {
    return true;
  }
  try {
    const info = await fetchTokenInfo(token);
    if (!info || info.error || !isOurClient(info) || !isAllowedWorkspace(info)) {
      return false;
    }
    const googleExpiryMs = info.exp ? Number(info.exp) * MILLISECONDS_PER_SECOND : Date.now();
    tokenCache.set(token, {
      validUntil: Math.min(Date.now() + TOKEN_CACHE_TTL_MS, googleExpiryMs),
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
