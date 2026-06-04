import { createFileRoute } from '@tanstack/react-router';
import { RecordsDashboard } from '#/features/records/records-dashboard.tsx';
import { normalizeRouteSearch } from '#/lib/records-search.ts';

export const Route = createFileRoute('/')({
  validateSearch: normalizeRouteSearch,
  component: DashboardRoute,
});

function DashboardRoute() {
  const search = Route.useSearch();
  return <RecordsDashboard search={search} />;
}
