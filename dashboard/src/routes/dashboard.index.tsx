import { createFileRoute, redirect } from '@tanstack/react-router';

// Legacy /dashboard root → new root. See dashboard.$.tsx.
export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
