import { createFileRoute, redirect } from '@tanstack/react-router';

// Legacy: the dashboard used to live under /dashboard. Redirect old bookmarks and
// in-flight sessions to the new root so they are not left on a dead path.
export const Route = createFileRoute('/dashboard/$')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
