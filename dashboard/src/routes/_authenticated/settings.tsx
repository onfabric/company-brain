import { createFileRoute } from '@tanstack/react-router';
import { SettingsView } from '#/features/settings/settings-view.tsx';

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { auth } = Route.useRouteContext();
  return <SettingsView currentUserId={auth.session?.user.id} />;
}
