import { Elysia } from 'elysia';
import { signInHTML } from '#lib/oauth-pages.ts';

// better-auth redirects unauthenticated OAuth `authorize` requests here with the
// original request as the query string; the same query, replayed against the
// authorize endpoint, resumes the flow once the user has signed in with Google.
export const signInController = new Elysia().get(
  '/sign-in',
  ({ query, set }) => {
    const search = new URLSearchParams(query as Record<string, string>).toString();
    const callbackURL = search
      ? `/api/auth/oauth2/authorize?${search}`
      : '/api/auth/oauth2/authorize';
    set.headers['content-type'] = 'text/html';
    return signInHTML(callbackURL);
  },
  { detail: { hide: true } },
);
