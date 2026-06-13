import { Elysia, StatusMap } from 'elysia';
import { auth } from '#lib/auth.ts';

export const REQUIRE_AUTH_MACRO_NAME = 'betterAuth';

// Mounts better-auth's handler (it routes by its own `basePath`, so `.mount`
// takes no path prefix) and exposes a macro that resolves the logged-in
// `{ user, session }` from the request, answering 401 when there is none.
export const authPlugin = new Elysia({ name: 'better-auth' }).mount(auth.handler).macro({
  [REQUIRE_AUTH_MACRO_NAME]: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      if (!session) {
        return status(StatusMap.Unauthorized);
      }
      return { user: session.user, session: session.session };
    },
  },
});
