import { Elysia, StatusMap, t } from 'elysia';
import {
  API_KEY_HEADER,
  API_KEY_SECURITY_SCHEME,
  getHeader,
  type RequestHeaders,
} from '#lib/auth/api-key.ts';
import { hasValidSession, SESSION_SECURITY_SCHEME } from '#lib/auth/better-auth.ts';
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

const VERIFY: Record<AuthMethod, (ctx: VerifierContext) => boolean | Promise<boolean>> = {
  [AuthMethod.ApiKey]: ({ headers, apiKeysService }) =>
    apiKeysService.verify(getHeader(headers, API_KEY_HEADER)),
  [AuthMethod.Session]: ({ request }) => hasValidSession(request.headers),
};

const SECURITY_SCHEME: Record<AuthMethod, string> = {
  [AuthMethod.ApiKey]: API_KEY_SECURITY_SCHEME,
  [AuthMethod.Session]: SESSION_SECURITY_SCHEME,
};

// One auth plugin exposing a single `requireAuth` macro: an endpoint lists the
// methods it accepts and passes if any one verifies (OR). Each method is a
// self-contained strategy (verifier + OpenAPI scheme); adding one is a single
// entry in the maps above.
export const authPlugin = new Elysia({ name: 'auth' }).use(ApiKeysServicePlugin).macro({
  [REQUIRE_AUTH]: (methods: AuthMethod[]) => ({
    detail: { security: methods.map((method) => ({ [SECURITY_SCHEME[method]]: [] })) },
    response: {
      [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
    },
    async beforeHandle({ headers, request, status, apiKeysService }) {
      if (!(await isAuthorized(methods, { headers, request, apiKeysService }))) {
        return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
      }
    },
  }),
});

async function isAuthorized(methods: AuthMethod[], ctx: VerifierContext): Promise<boolean> {
  for (const method of methods) {
    const verify = VERIFY[method];
    if (await verify(ctx)) {
      return true;
    }
  }
  return false;
}
