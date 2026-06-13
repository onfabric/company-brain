import { Elysia, StatusMap, t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import { API_KEY_SECURITY_SCHEME, hasValidApiKey } from '#lib/api-key-auth.ts';
import { auth } from '#lib/auth.ts';

export const SESSION_SECURITY_SCHEME = 'betterAuthSession';

export const sessionSecuritySchemes = {
  [SESSION_SECURITY_SCHEME]: {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
    description: 'better-auth session cookie set after signing in with Google',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

// `auth: true` protects a route with either a valid Api-Key header or a
// better-auth session cookie. A valid api key short-circuits the session lookup.
export const authMacro = new Elysia({ name: 'auth' }).macro('auth', {
  detail: {
    security: [{ [API_KEY_SECURITY_SCHEME]: [] }, { [SESSION_SECURITY_SCHEME]: [] }],
  },
  response: {
    [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
  },
  async beforeHandle({ headers, request, status }) {
    if (hasValidApiKey(headers) || (await hasValidSession(request.headers))) {
      return;
    }
    return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
  },
});

async function hasValidSession(headers: Headers): Promise<boolean> {
  try {
    return (await auth.api.getSession({ headers })) !== null;
  } catch {
    return false;
  }
}
