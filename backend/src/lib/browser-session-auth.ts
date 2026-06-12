import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { type CookieOptions, Elysia, StatusMap, t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import { API_KEY_SECURITY_SCHEME, hasValidApiKey, type RequestHeaders } from '#lib/api-key-auth.ts';
import { env } from '#lib/env.ts';

export const BRAIN_SESSION_COOKIE = 'brain_session';
export const BRAIN_SESSION_TTL_SECONDS = 60 * 60 * 24;

const COOKIE_PATH = '/knowledge/pages';
const MILLISECONDS_PER_SECOND = 1_000;
const NONCE_BYTES = 16;
const SESSION_VERSION = 1;

type BrainSessionPayload = {
  v: typeof SESSION_VERSION;
  exp: number;
  nonce: string;
};

export const REQUIRE_KNOWLEDGE_PAGE_AUTH_MACRO_NAME = 'requireKnowledgePageAuth';
export const BRAIN_SESSION_SECURITY_SCHEME = 'brainSession';

export const brainSessionSecuritySchemes = {
  [BRAIN_SESSION_SECURITY_SCHEME]: {
    type: 'apiKey',
    in: 'cookie',
    name: BRAIN_SESSION_COOKIE,
    description: 'Browser session cookie minted by POST /sessions',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

export const BrainSessionCookieSchema = t.Cookie({
  [BRAIN_SESSION_COOKIE]: t.Optional(t.String()),
});

export const knowledgePageAuth = new Elysia({ name: 'knowledgePageAuth' }).macro(
  REQUIRE_KNOWLEDGE_PAGE_AUTH_MACRO_NAME,
  {
    detail: {
      security: [{ [API_KEY_SECURITY_SCHEME]: [] }, { [BRAIN_SESSION_SECURITY_SCHEME]: [] }],
    },
    response: {
      [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
    },
    cookie: BrainSessionCookieSchema,
    beforeHandle({ cookie, headers, status }) {
      const sessionToken = cookie[BRAIN_SESSION_COOKIE]?.value;
      const authorized =
        hasValidApiKey(headers) ||
        (sessionToken !== undefined && isValidBrainSessionToken(sessionToken));
      if (!authorized) {
        return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
      }
    },
  },
);

export function brainSessionCookieAttributes(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    path: COOKIE_PATH,
    sameSite: 'lax',
    maxAge: BRAIN_SESSION_TTL_SECONDS,
    secure,
  };
}

export function isSecureCookieRequest(headers: RequestHeaders, url: string): boolean {
  const forwardedProto = headerValue(headers, 'x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto === 'https') {
    return true;
  }
  return new URL(url).protocol === 'https:';
}

export function createBrainSessionToken(now = Date.now()): string {
  const payload: BrainSessionPayload = {
    v: SESSION_VERSION,
    exp: Math.floor(now / MILLISECONDS_PER_SECOND) + BRAIN_SESSION_TTL_SECONDS,
    nonce: randomBytes(NONCE_BYTES).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function isValidBrainSessionToken(token: string, now = Date.now()): boolean {
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra !== undefined) {
    return false;
  }
  if (!signatureMatches(encodedPayload, signature)) {
    return false;
  }

  const payload = parsePayload(encodedPayload);
  if (!payload) {
    return false;
  }

  return payload.v === SESSION_VERSION && payload.exp >= Math.floor(now / MILLISECONDS_PER_SECOND);
}

function parsePayload(encodedPayload: string): BrainSessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.v !== 'number' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.nonce !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function signatureMatches(payload: string, signature: string): boolean {
  const expected = Buffer.from(sign(payload), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(payload: string): string {
  return createHmac('sha256', env.brainApiKey).update(payload).digest('base64url');
}

function headerValue(headers: RequestHeaders, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}
