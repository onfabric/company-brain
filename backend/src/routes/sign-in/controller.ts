import { Elysia } from 'elysia';
import { signInHTML } from '#lib/auth/oauth-pages.ts';

const DEFAULT_CALLBACK_URL = '/dashboard';

// better-auth redirects unauthenticated OAuth `authorize` requests here with the
// original request as the query string; the same query, replayed against the
// authorize endpoint, resumes the flow once the user has signed in with Google.
// Without those authorize params the page is the dashboard's own login: it sends
// the user back to the `callbackURL` once a session cookie is set.
export const signInController = new Elysia().get(
  '/sign-in',
  ({ query, set }) => {
    const { callbackURL, ...authorizeParams } = query as Record<string, string>;
    const search = new URLSearchParams(authorizeParams).toString();
    const target = search ? `/api/auth/oauth2/authorize?${search}` : safeCallbackURL(callbackURL);
    set.headers['content-type'] = 'text/html';
    return signInHTML(target);
  },
  { detail: { hide: true } },
);

// Only same-origin relative paths are allowed so the post-login redirect cannot
// be pointed at an attacker-controlled destination.
function safeCallbackURL(value: string | undefined): string {
  if (value?.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return DEFAULT_CALLBACK_URL;
}
