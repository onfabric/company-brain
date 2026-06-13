import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { createAuth } from '#/lib/auth.ts';
import { routeTree } from './routeTree.gen.ts';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    context: { auth: createAuth() },
    basepath: '/dashboard',
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
