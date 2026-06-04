import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent } from '#/components/ui/card.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import { RecordPreview } from '#/features/records/record-preview.tsx';
import { RecordsFilters } from '#/features/records/records-filters.tsx';
import { RecordsTable } from '#/features/records/records-table.tsx';
import { listDataSources, listPeople, listRecords, type RecordHit } from '#/lib/brain-functions.ts';
import { DEFAULT_LIMIT, EMPTY_COUNT, EMPTY_OFFSET, FIRST_PAGE } from '#/lib/constants.ts';
import {
  cleanRouteSearch,
  type RecordsRouteSearch,
  toRecordsQueryInput,
} from '#/lib/records-search.ts';

type RecordsDashboardProps = {
  search: RecordsRouteSearch;
};

const PAGE_WINDOW_LABEL_OFFSET = FIRST_PAGE;
const LOADING_ROW_KEYS = [
  'loading-row-a',
  'loading-row-b',
  'loading-row-c',
  'loading-row-d',
  'loading-row-e',
  'loading-row-f',
  'loading-row-g',
  'loading-row-h',
  'loading-row-i',
  'loading-row-j',
  'loading-row-k',
  'loading-row-l',
  'loading-row-m',
  'loading-row-n',
  'loading-row-o',
  'loading-row-p',
  'loading-row-q',
  'loading-row-r',
  'loading-row-s',
  'loading-row-t',
];

export function RecordsDashboard({ search }: RecordsDashboardProps) {
  const navigate = useNavigate({ from: '/' });
  const recordsInput = toRecordsQueryInput(search);
  const recordsQuery = useQuery({
    queryKey: ['records', recordsInput],
    queryFn: () => listRecords({ data: recordsInput }),
    placeholderData: keepPreviousData,
  });
  const sourcesQuery = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => listDataSources(),
  });
  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => listPeople({ data: {} }),
  });

  const sources = sourcesQuery.data?.sources ?? [];
  const people = peopleQuery.data?.people ?? [];
  const records = useMemo(() => {
    const sourceLabels = new Map(
      sources.map((source) => [source.data_source_id, source.data_source_key]),
    );
    return (recordsQuery.data?.results ?? [])
      .map((record) => ({
        ...record,
        data_source_key: sourceLabels.get(record.data_source_id) ?? record.data_source_key,
      }))
      .sort((left, right) => {
        if (search.q) {
          return EMPTY_COUNT;
        }
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });
  }, [recordsQuery.data?.results, search.q, sources]);
  const selectedRecord = selectedRecordFor(records, search.selectedRecordId);
  const total = recordsQuery.data?.total ?? EMPTY_COUNT;
  const limit = recordsQuery.data?.limit ?? search.limit ?? DEFAULT_LIMIT;
  const currentPage = search.page || FIRST_PAGE;
  const totalPages = Math.max(FIRST_PAGE, Math.ceil(total / limit));
  const rangeStart =
    total > EMPTY_COUNT
      ? (currentPage - FIRST_PAGE) * limit + PAGE_WINDOW_LABEL_OFFSET
      : EMPTY_OFFSET;
  const rangeEnd = Math.min(currentPage * limit, total);

  const updateSearch = (next: Partial<RecordsRouteSearch>, resetPage = true) => {
    void navigate({
      search: (previous) =>
        cleanRouteSearch({
          ...previous,
          ...next,
          page: resetPage ? FIRST_PAGE : (next.page ?? previous.page ?? FIRST_PAGE),
          limit: next.limit ?? previous.limit ?? DEFAULT_LIMIT,
        }),
    });
  };

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-lg">Company Brain Records</h1>
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} records matching current filters
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void recordsQuery.refetch()}
            disabled={recordsQuery.isFetching}
          >
            <RefreshCw className={recordsQuery.isFetching ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </header>

      <RecordsFilters
        search={search}
        sources={sources}
        people={people}
        isFetching={recordsQuery.isFetching}
        onChange={updateSearch}
      />

      <section className="grid gap-4 p-4 xl:grid-cols-[minmax(36rem,1.1fr)_minmax(28rem,0.9fr)]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {recordsQuery.isLoading ? (
              <LoadingRows />
            ) : recordsQuery.isError ? (
              <ErrorState message={recordsQuery.error.message} />
            ) : records.length === EMPTY_COUNT ? (
              <EmptyState />
            ) : (
              <RecordsTable
                records={records}
                selectedRecordId={selectedRecord?.id}
                onSelectRecord={(id) => updateSearch({ selectedRecordId: id }, false)}
              />
            )}
          </CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= FIRST_PAGE || recordsQuery.isFetching}
                onClick={() => updateSearch({ page: currentPage - FIRST_PAGE }, false)}
              >
                <ChevronLeft />
                Previous
              </Button>
              <span className="min-w-24 text-center text-muted-foreground">
                Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || recordsQuery.isFetching}
                onClick={() => updateSearch({ page: currentPage + FIRST_PAGE }, false)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>

        <RecordPreview record={selectedRecord} />
      </section>
    </main>
  );
}

function selectedRecordFor(records: RecordHit[], selectedRecordId: string | undefined) {
  return records.find((record) => record.id === selectedRecordId) ?? records[EMPTY_COUNT] ?? null;
}

function LoadingRows() {
  return (
    <div className="grid gap-3 p-4">
      {LOADING_ROW_KEYS.map((key) => (
        <Skeleton key={key} className="h-14 w-full" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="grid min-h-72 place-items-center p-8 text-center">
      <div className="max-w-xl">
        <h2 className="font-semibold">Could not load records</h2>
        <p className="mt-2 text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-72 place-items-center p-8 text-center text-muted-foreground text-sm">
      No records found.
    </div>
  );
}
