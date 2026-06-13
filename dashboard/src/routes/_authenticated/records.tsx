import { createFileRoute } from '@tanstack/react-router';
import { RecordsView } from '#/features/records/records-view.tsx';
import { normalizeRouteSearch } from '#/lib/records-search.ts';

export const Route = createFileRoute('/_authenticated/records')({
  validateSearch: normalizeRouteSearch,
  component: RecordsRoute,
});

function RecordsRoute() {
  const search = Route.useSearch();
  return <RecordsView search={search} />;
}
