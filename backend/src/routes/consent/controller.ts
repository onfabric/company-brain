import { Elysia } from 'elysia';
import { authPlugin, REQUIRE_AUTH_MACRO_NAME } from '#lib/auth-session.ts';
import { consentHTML } from '#lib/oauth-pages.ts';
import { ConsentQuerySchema } from '#routes/consent/model.ts';

/**
 * better-auth redirects here with the signed authorize request (client id,
 * scopes, and the `sig`/`ba_param` set) after authentication; the session macro
 * binds the page to the logged-in user (401 otherwise), and accepting replays
 * the page's query string back to better-auth as `oauth_query`.
 */
export const consentController = new Elysia().use(authPlugin).get(
  '/consent',
  ({ query, set }) => {
    const scopes = query.scope ? query.scope.split(' ').filter(Boolean) : [];
    set.headers['content-type'] = 'text/html';
    return consentHTML(query.client_id, scopes);
  },
  {
    [REQUIRE_AUTH_MACRO_NAME]: true,
    query: ConsentQuerySchema,
    detail: { hide: true },
  },
);
