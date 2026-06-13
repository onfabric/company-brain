import { createFileRoute } from '@tanstack/react-router';
import { SignInView } from '#/features/auth/sign-in-view.tsx';

export const Route = createFileRoute('/sign-in')({
  component: SignInView,
});
