import { createBrainClient } from '@company-brain/backend-client';
import { redirectToSignIn } from '#/lib/auth.ts';

// The dashboard is served from the same origin as the brain API. Treaty needs an
// absolute base (an empty domain resolves the first path segment as the host), and
// the origin keeps the vite dev proxy and production on the same path.
// parseDate:false keeps ISO datetime fields as strings. By default Treaty revives
// them into Date objects at runtime even though the types say string, which both
// breaks string operations (e.g. slicing created_at) and diverges from the types.
export const { brain, unwrap } = createBrainClient({
  domain: window.location.origin,
  treatyOptions: {
    fetch: { credentials: 'include' },
    headers: { accept: 'application/json' },
    parseDate: false,
  },
  onUnauthorized: redirectToSignIn,
  unauthorizedMessage: 'Your session has expired. Redirecting to sign in...',
});
