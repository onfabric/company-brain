import { createFileRoute } from '@tanstack/react-router';
import { PeopleView } from '#/features/people/people-view.tsx';

export const Route = createFileRoute('/_authenticated/people')({
  component: PeopleView,
});
