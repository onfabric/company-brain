import { createFileRoute } from '@tanstack/react-router';
import { ConsentView } from '#/features/auth/consent-view.tsx';

export const Route = createFileRoute('/consent')({
  component: ConsentView,
});
