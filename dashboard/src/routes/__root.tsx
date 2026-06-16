import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { useState } from 'react';
import { TooltipProvider } from '#/components/ui/tooltip.tsx';
import type { AuthContext } from '#/lib/auth.ts';

export type RouterContext = {
  auth: AuthContext;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
