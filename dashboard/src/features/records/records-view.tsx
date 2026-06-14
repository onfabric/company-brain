import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { Card } from '#/components/ui/card.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import { RecordPreview } from '#/features/records/record-preview.tsx';
import { RecordsFilters } from '#/features/records/records-filters.tsx';
import { RecordsTable } from '#/features/records/records-table.tsx';
import { listDataSources, listRecords, type RecordHit } from '#/lib/brain-functions.ts';
import { DEFAULT_LIMIT, EMPTY_COUNT, EMPTY_OFFSET } from '#/lib/constants.ts';
import {
  cleanRouteSearch,
  type RecordsRouteSearch,
  toListRecordsInput,
} from '#/lib/records-search.ts';
import { useInfiniteScroll } from '#/lib/use-infinite-scroll.ts';

type RecordsViewProps = {
  search: RecordsRouteSearch;
};

const SKELETON_ROW_KEYS = Array.from({ length: 20 }, (_, i) => `skeleton-row-${i}`);

export function RecordsView({ search }: RecordsViewProps) {
  const navigate = useNavigate({ from: '/records' });
  const recordsInput = toListRecordsInput(search);
  const recordsQuery = useInfiniteQuery({
    queryKey: ['records', recordsInput],
    queryFn: ({ pageParam }) => listRecords({ ...recordsInput, offset: pageParam }),
    initialPageParam: EMPTY_OFFSET,
    getNextPageParam: (lastPage, allPages) => {
      const matchTotal = allPages[EMPTY_COUNT]?.total ?? EMPTY_COUNT;
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < matchTotal ? nextOffset : undefined;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });
  const sourcesQuery = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => listDataSources(),
    retry: false,
  });

  const sources = sourcesQuery.data?.sources ?? [];
  const records = useMemo(() => {
    const sourceLabels = new Map(
      sources.map((source) => [source.data_source_id, source.data_source_key]),
    );
    const hits = recordsQuery.data?.pages.flatMap((page) => page.results) ?? [];
    return hits.map((record) => ({
      ...record,
      data_source_key: sourceLabels.get(record.data_source_id) ?? record.data_source_key,
    }));
  }, [recordsQuery.data, sources]);
  const selectedRecord = selectedRecordFor(records, search.selectedRecordId);
  const total = recordsQuery.data?.pages[EMPTY_COUNT]?.total ?? EMPTY_COUNT;
  const { scrollRef: recordsScrollRef, sentinelRef: recordsSentinelRef } = useInfiniteScroll({
    hasNextPage: recordsQuery.hasNextPage,
    isFetchingNextPage: recordsQuery.isFetchingNextPage,
    fetchNextPage: recordsQuery.fetchNextPage,
  });

  const updateSearch = (next: Partial<RecordsRouteSearch>) => {
    void navigate({
      search: (previous) =>
        cleanRouteSearch({
          ...previous,
          ...next,
          limit: next.limit ?? previous.limit ?? DEFAULT_LIMIT,
        }),
    });
  };

  return (
    <>
      <div className="shrink-0">
        <RecordsFilters
          search={search}
          sources={sources}
          isFetching={recordsQuery.isFetching}
          onChange={updateSearch}
        />
      </div>

      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(36rem,1.1fr)_minmax(28rem,0.9fr)] xl:grid-rows-1">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <div ref={recordsScrollRef} className="min-h-0 flex-1 overflow-auto">
            {recordsQuery.isLoading ? (
              <LoadingRows />
            ) : recordsQuery.isError ? (
              <ErrorState error={recordsQuery.error} />
            ) : records.length === EMPTY_COUNT ? (
              <EmptyState />
            ) : (
              <>
                <RecordsTable
                  records={records}
                  selectedRecordId={selectedRecord?.id}
                  onSelectRecord={(id) => updateSearch({ selectedRecordId: id })}
                />
                <div ref={recordsSentinelRef} />
                {recordsQuery.isFetchingNextPage ? <LoadingMore /> : null}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 text-muted-foreground text-sm">
            <span>
              Showing {records.length.toLocaleString()} of {total.toLocaleString()}
            </span>
          </div>
        </Card>

        <RecordPreview record={selectedRecord} />
      </section>
    </>
  );
}

function selectedRecordFor(records: RecordHit[], selectedRecordId: string | undefined) {
  return records.find((record) => record.id === selectedRecordId) ?? records[EMPTY_COUNT] ?? null;
}

function LoadingRows() {
  return (
    <div className="grid gap-3 p-4">
      {SKELETON_ROW_KEYS.map((key) => (
        <Skeleton key={key} className="h-14 w-full" />
      ))}
    </div>
  );
}

function LoadingMore() {
  return (
    <div className="flex items-center justify-center gap-2 border-t py-4 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" />
      Loading more...
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="grid min-h-72 place-items-center p-8 text-center">
      <div className="max-w-xl">
        <h2 className="font-semibold">Could not load records</h2>
        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
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
