import { Elysia, t } from 'elysia';
import { authPlugin, REQUIRE_AUTH_MACRO_NAME } from '#lib/auth-session.ts';
import { consentHTML } from '#lib/oauth-pages.ts';

/**
 * better-auth redirects here with the consent code, client id, and requested
 * scopes after authentication; the session macro binds the page to the
 * logged-in user (401 otherwise), and accepting posts back to better-auth.
 */
export const consentController = new Elysia().use(authPlugin).get(
  '/consent',
  ({ query, set }) => {
    const scopes = query.scope ? query.scope.split(' ').filter(Boolean) : [];
    set.headers['content-type'] = 'text/html';
    return consentHTML(query.client_id, scopes, query.consent_code);
  },
  {
    [REQUIRE_AUTH_MACRO_NAME]: true,
    query: t.Object({
      consent_code: t.String(),
      client_id: t.String(),
      scope: t.Optional(t.String()),
    }),
    detail: { hide: true },
  },
);
