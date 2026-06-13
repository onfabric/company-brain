import { Elysia, StatusMap, t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import {
  API_KEY_SECURITY_SCHEME,
  getHeader,
  hasValidApiKey,
  type RequestHeaders,
} from '#lib/api-key-auth.ts';
import { auth } from '#lib/auth.ts';

export const SESSION_SECURITY_SCHEME = 'betterAuthSession';
export const REQUIRE_AUTH_MACRO_NAME = 'requireAuth';

const SESSION_COOKIE_MARKER = 'session_token';

export const sessionSecuritySchemes = {
  [SESSION_SECURITY_SCHEME]: {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
    description: 'better-auth session cookie set after signing in with Google',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

// better-auth reads its own session cookie from the request headers; gate the DB
// round-trip on the cookie actually being present so the api-key path and
// unauthenticated requests stay free of a session lookup.
export async function hasValidSession(headers: Headers): Promise<boolean> {
  if (!getHeader(headers, 'cookie')?.includes(SESSION_COOKIE_MARKER)) {
    return false;
  }
  try {
    const session = await auth.api.getSession({ headers });
    return session !== null;
  } catch {
    return false;
  }
}

export async function isAuthorized(headers: RequestHeaders, request: Request): Promise<boolean> {
  return hasValidApiKey(headers) || (await hasValidSession(request.headers));
}

export const brainAuth = new Elysia({ name: 'brainAuth' }).macro(REQUIRE_AUTH_MACRO_NAME, {
  detail: {
    security: [{ [API_KEY_SECURITY_SCHEME]: [] }, { [SESSION_SECURITY_SCHEME]: [] }],
  },
  response: {
    [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
  },
  async beforeHandle({ headers, request, status }) {
    if (!(await isAuthorized(headers, request))) {
      return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
    }
  },
});
