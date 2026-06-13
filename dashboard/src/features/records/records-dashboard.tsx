import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BookOpen, FileText, Loader2, LogOut, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card } from '#/components/ui/card.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import { KnowledgeExplorer } from '#/features/knowledge/knowledge-explorer.tsx';
import { PeopleManager } from '#/features/people/people-manager.tsx';
import { RecordPreview } from '#/features/records/record-preview.tsx';
import { RecordsFilters } from '#/features/records/records-filters.tsx';
import { RecordsTable } from '#/features/records/records-table.tsx';
import { signOut } from '#/lib/auth.ts';
import { listDataSources, listPeople, listRecords, type RecordHit } from '#/lib/brain-functions.ts';
import {
  DEFAULT_LIMIT,
  DEFAULT_PEOPLE_SORT_FIELD,
  DEFAULT_PEOPLE_SORT_ORDER,
  EMPTY_COUNT,
  EMPTY_OFFSET,
  PEOPLE_PAGE_SIZE,
} from '#/lib/constants.ts';
import {
  cleanRouteSearch,
  type RecordsRouteSearch,
  toRecordsQueryInput,
} from '#/lib/records-search.ts';
import { useInfiniteScroll } from '#/lib/use-infinite-scroll.ts';

type RecordsDashboardProps = {
  search: RecordsRouteSearch;
};

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
  const activeTab = search.tab ?? 'records';
  const recordsInput = toRecordsQueryInput(search);
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
  const peopleQuery = useInfiniteQuery({
    queryKey: ['people', DEFAULT_PEOPLE_SORT_FIELD, DEFAULT_PEOPLE_SORT_ORDER],
    queryFn: ({ pageParam }) =>
      listPeople({
        sortBy: DEFAULT_PEOPLE_SORT_FIELD,
        sortOrder: DEFAULT_PEOPLE_SORT_ORDER,
        limit: PEOPLE_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: EMPTY_OFFSET,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.people.length, EMPTY_COUNT);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: activeTab === 'people',
    retry: false,
  });

  const sources = sourcesQuery.data?.sources ?? [];
  const people = useMemo(
    () => peopleQuery.data?.pages.flatMap((page) => page.people) ?? [],
    [peopleQuery.data],
  );
  const peopleTotal = peopleQuery.data?.pages[EMPTY_COUNT]?.total ?? EMPTY_COUNT;
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
  const headerDescription = descriptionForTab(activeTab, peopleTotal, total);

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
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-lg">Company Brain</h1>
            <p className="text-muted-foreground text-sm">{headerDescription}</p>
          </div>
          <div className="flex rounded-md border bg-background p-1" role="tablist">
            <Button
              type="button"
              role="tab"
              size="sm"
              variant={activeTab === 'records' ? 'secondary' : 'ghost'}
              aria-selected={activeTab === 'records'}
              onClick={() => updateSearch({ tab: 'records' })}
            >
              <FileText />
              Records
            </Button>
            <Button
              type="button"
              role="tab"
              size="sm"
              variant={activeTab === 'people' ? 'secondary' : 'ghost'}
              aria-selected={activeTab === 'people'}
              onClick={() => updateSearch({ tab: 'people' })}
            >
              <Users />
              People
            </Button>
            <Button
              type="button"
              role="tab"
              size="sm"
              variant={activeTab === 'knowledge' ? 'secondary' : 'ghost'}
              aria-selected={activeTab === 'knowledge'}
              onClick={() => updateSearch({ tab: 'knowledge', selectedKnowledgeId: undefined })}
            >
              <BookOpen />
              Knowledge
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={() => void signOut()}>
            <LogOut />
            Log out
          </Button>
        </div>
      </header>

      {activeTab === 'records' ? (
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
      ) : null}

      {activeTab === 'people' ? (
        <PeopleManager
          people={people}
          total={peopleTotal}
          isLoading={peopleQuery.isLoading}
          isFetching={peopleQuery.isFetching && !peopleQuery.isFetchingNextPage}
          isFetchingNextPage={peopleQuery.isFetchingNextPage}
          hasNextPage={peopleQuery.hasNextPage}
          fetchNextPage={peopleQuery.fetchNextPage}
          error={peopleQuery.error}
        />
      ) : null}

      {activeTab === 'knowledge' ? (
        <KnowledgeExplorer search={search} onChange={updateSearch} />
      ) : null}
    </main>
  );
}

function descriptionForTab(activeTab: string, peopleTotal: number, recordsTotal: number) {
  switch (activeTab) {
    case 'people':
      return `${peopleTotal.toLocaleString()} people ranked by records`;
    case 'knowledge':
      return 'Knowledge index';
    default:
      return `${recordsTotal.toLocaleString()} records matching current filters`;
  }
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
