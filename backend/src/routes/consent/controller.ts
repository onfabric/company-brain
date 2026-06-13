import { Elysia } from 'elysia';
import { auth } from '#lib/auth.ts';
import { consentHTML } from '#lib/oauth-pages.ts';
import { ConsentQuerySchema } from '#routes/consent/model.ts';

// The consent redirect only carries the client id, so resolve the registered
// display name from better-auth's public-client endpoint; fall back to the id.
async function clientName(clientId: string, headers: Headers): Promise<string> {
  try {
    const client = await auth.api.getOAuthClientPublic({ query: { client_id: clientId }, headers });
    return client?.client_name ?? clientId;
  } catch {
    return clientId;
  }
}

/**
 * better-auth redirects here with the signed authorize request (client id,
 * scopes, and the `sig`/`ba_param` set) after login; accepting replays the
 * page's query string back to better-auth as `oauth_query`, whose `/oauth2/consent`
 * endpoint enforces the session.
 */
export const consentController = new Elysia().get(
  '/consent',
  async ({ query, request, set }) => {
    const scopes = query.scope ? query.scope.split(' ').filter(Boolean) : [];
    set.headers['content-type'] = 'text/html';
    return consentHTML(await clientName(query.client_id, request.headers), scopes);
  },
  {
    query: ConsentQuerySchema,
    detail: { hide: true },
  },
);
