import { Elysia } from 'elysia';
import { consentHTML } from '#lib/oauth-pages.ts';
import { ConsentQuerySchema } from '#routes/consent/model.ts';

/**
 * better-auth redirects here with the signed authorize request (client id,
 * scopes, and the `sig`/`ba_param` set) after login; accepting replays the
 * page's query string back to better-auth as `oauth_query`, whose `/oauth2/consent`
 * endpoint enforces the session.
 */
export const consentController = new Elysia().get(
  '/consent',
  ({ query, set }) => {
    const scopes = query.scope ? query.scope.split(' ').filter(Boolean) : [];
    set.headers['content-type'] = 'text/html';
    return consentHTML(query.client_id, scopes);
  },
  {
    query: ConsentQuerySchema,
    detail: { hide: true },
  },
);
