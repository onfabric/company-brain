import { Elysia, StatusMap } from 'elysia';
import { auth } from '#lib/auth.ts';

export const REQUIRE_AUTH_MACRO_NAME = 'betterAuth';

// better-auth's request handler is mounted on the shared mcp-use Hono app (see
// the MCP controller); this plugin only exposes the macro that resolves the
// logged-in `{ user, session }` from the request, answering 401 when there is none.
export const authPlugin = new Elysia({ name: 'better-auth' }).macro({
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
