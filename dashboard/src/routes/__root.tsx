import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { getAuthSession, signInUrl } from '#/lib/auth.ts';

export const Route = createRootRoute({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) {
      throw redirect({ href: signInUrl() });
    }
  },
  component: RootLayout,
});

function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
