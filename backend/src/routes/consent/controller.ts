import { Elysia, t } from 'elysia';
import { consentHTML } from '#lib/oauth-pages.ts';

// better-auth redirects to here with the consent code, client id, and requested
// scopes after authentication; accepting posts back to its consent endpoint.
export const consentController = new Elysia().get(
  '/consent',
  ({ query, set }) => {
    set.headers['content-type'] = 'text/html';
    const scopes = query.scope ? query.scope.split(' ').filter(Boolean) : [];
    return consentHTML(query.client_id, scopes, query.consent_code);
  },
  {
    query: t.Object({
      consent_code: t.String(),
      client_id: t.String(),
      scope: t.Optional(t.String()),
    }),
    detail: { hide: true },
  },
);
