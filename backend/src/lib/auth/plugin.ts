import { Elysia, StatusMap, t } from 'elysia';
import {
  API_KEY_HEADER,
  API_KEY_SECURITY_SCHEME,
  getHeader,
  type RequestHeaders,
} from '#lib/auth/api-key.ts';
import { type AuthUser, SESSION_SECURITY_SCHEME, sessionUser } from '#lib/auth/better-auth.ts';
import type { ApiKeysService } from '#services/api-keys.service.ts';
import { ApiKeysServicePlugin } from '#services/plugins.ts';

export enum AuthMethod {
  ApiKey = 'apiKey',
  Session = 'session',
}

export const REQUIRE_AUTH = 'requireAuth';

type VerifierContext = {
  headers: RequestHeaders;
  request: Request;
  apiKeysService: ApiKeysService;
};

// The principal a successful method resolves into the handler context,
// discriminated by which method authenticated: Session carries the better-auth
// user, ApiKey carries no user. A failing method resolves to null.
export type AuthSession =
  | { authType: AuthMethod.Session; user: AuthUser }
  | { authType: AuthMethod.ApiKey };

const VERIFY: Record<AuthMethod, (ctx: VerifierContext) => Promise<AuthSession | null>> = {
  [AuthMethod.ApiKey]: async ({ headers, apiKeysService }) => {
    const isValidApiKey = await apiKeysService.verify(getHeader(headers, API_KEY_HEADER));
    return isValidApiKey ? { authType: AuthMethod.ApiKey } : null;
  },
  [AuthMethod.Session]: async ({ request }) => {
    const user = await sessionUser(request.headers);
    return user ? { authType: AuthMethod.Session, user } : null;
  },
};

const SECURITY_SCHEME: Record<AuthMethod, string> = {
  [AuthMethod.ApiKey]: API_KEY_SECURITY_SCHEME,
  [AuthMethod.Session]: SESSION_SECURITY_SCHEME,
};

// One `requireAuth` macro: an endpoint lists the methods it accepts and passes if
// any one verifies (OR). It `resolve`s the authenticated `session` into context as
// a non-nullable union — a request that satisfies no method is rejected with 401
// before any handler runs. Endpoints (or the services they call) narrow on
// `session.authType` to enforce method-specific rules, e.g. "only a user".
export const authPlugin = new Elysia({ name: 'auth' }).use(ApiKeysServicePlugin).macro({
  [REQUIRE_AUTH]: (methods: AuthMethod[]) => ({
    detail: { security: methods.map((method) => ({ [SECURITY_SCHEME[method]]: [] })) },
    response: {
      [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
    },
    async resolve({ headers, request, status, apiKeysService }) {
      const session = await authenticate(methods, { headers, request, apiKeysService });
      if (!session) {
        return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
      }
      return { session };
    },
  }),
});

async function authenticate(
  methods: AuthMethod[],
  ctx: VerifierContext,
): Promise<AuthSession | null> {
  for (const method of methods) {
    const session = await VERIFY[method](ctx);
    if (session) {
      return session;
    }
  }
  return null;
}
