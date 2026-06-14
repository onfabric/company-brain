import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { NotFound } from '#/features/not-found.tsx';
import { createAuth } from '#/lib/auth.ts';
import { routeTree } from './routeTree.gen.ts';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    context: { auth: createAuth() },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // The backend serves index.html for any unmatched path, so unknown
    // client-side routes land here instead of TanStack's bare default.
    defaultNotFoundComponent: NotFound,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
