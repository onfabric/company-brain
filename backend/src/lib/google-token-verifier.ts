import { env } from '#lib/env.ts';

// Google access tokens are opaque (not JWTs), so they can't be JWKS-verified.
// They are validated by calling Google's tokeninfo endpoint, which returns the
// token's audience (the OAuth client it was minted for), expiry, and — for a
// Workspace login — the hosted domain / email. A short positive cache keeps
// this to roughly one network round-trip per token per TTL window.
type TokenInfo = {
  aud?: string;
  azp?: string;
  exp?: string;
  sub?: string;
  email?: string;
  hd?: string;
  error?: string;
};

type VerifiedPayload = { payload: Record<string, unknown> };

const MILLISECONDS_PER_SECOND = 1000;
const TOKEN_CACHE_TTL_SECONDS = 300;
const TOKEN_CACHE_TTL_MS = TOKEN_CACHE_TTL_SECONDS * MILLISECONDS_PER_SECOND;

const cache = new Map<string, { payload: Record<string, unknown>; validUntil: number }>();

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

// Shaped for mcp-use's `verifyToken`: resolves with the decoded payload, or
// throws if the token is not a valid onfabric.io Workspace token minted for the
// brain's Google client. The static brain api-key is also accepted as a bearer
// so internal callers keep their key-based access to /mcp (the api-key macro
// the rest of the app uses cannot wrap mcp-use's own /mcp handler).
export async function verifyGoogleAccessToken(token: string): Promise<VerifiedPayload> {
  if (token === env.brainApiKey) {
    return { payload: { sub: 'brain-api-key', aud: env.googleClientId } };
  }
  const cached = cache.get(token);
  if (cached && cached.validUntil > Date.now()) {
    return { payload: cached.payload };
  }
  const info = await fetchTokenInfo(token);
  if (!info || info.error || !isOurClient(info) || !isAllowedWorkspace(info)) {
    throw new Error('invalid Google access token');
  }
  const payload: Record<string, unknown> = {
    sub: info.sub,
    email: info.email,
    hd: info.hd,
    aud: info.aud,
  };
  const googleExpiryMs = info.exp ? Number(info.exp) * MILLISECONDS_PER_SECOND : Date.now();
  cache.set(token, {
    payload,
    validUntil: Math.min(Date.now() + TOKEN_CACHE_TTL_MS, googleExpiryMs),
  });
  return { payload };
}
