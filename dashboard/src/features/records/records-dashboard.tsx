import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BookOpen, FileText, KeyRound, Loader2, LogOut, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card } from '#/components/ui/card.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import { KnowledgeExplorer } from '#/features/knowledge/knowledge-explorer.tsx';
import { PeopleManager } from '#/features/people/people-manager.tsx';
import { ApiKeyGate } from '#/features/records/api-key-gate.tsx';
import { RecordPreview } from '#/features/records/record-preview.tsx';
import { RecordsFilters } from '#/features/records/records-filters.tsx';
import { RecordsTable } from '#/features/records/records-table.tsx';
import {
  clearStoredBrainApiKey,
  readStoredBrainApiKey,
  storeBrainApiKey,
} from '#/lib/api-key-storage.ts';
import {
  BrainApiError,
  listDataSources,
  listPeople,
  listRecords,
  type RecordHit,
} from '#/lib/brain-functions.ts';
import {
  DEFAULT_LIMIT,
  DEFAULT_PEOPLE_SORT_FIELD,
  DEFAULT_PEOPLE_SORT_ORDER,
  EMPTY_COUNT,
  EMPTY_OFFSET,
  FIRST_PAGE,
  HTTP_UNAUTHORIZED,
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
  const [apiKey, setApiKey] = useState<string | undefined>(() => readStoredBrainApiKey());
  const [apiKeyVersion, setApiKeyVersion] = useState(EMPTY_COUNT);
  const queryClient = useQueryClient();

  const updateApiKey = (nextApiKey: string) => {
    storeBrainApiKey(nextApiKey);
    setApiKey(nextApiKey);
    setApiKeyVersion((version) => version + FIRST_PAGE);
  };

  const clearApiKey = () => {
    clearStoredBrainApiKey();
    setApiKey(undefined);
    queryClient.removeQueries();
  };

  if (!apiKey) {
    return <ApiKeyGate onSubmit={updateApiKey} />;
  }

  return (
    <AuthenticatedRecordsDashboard
      apiKey={apiKey}
      apiKeyVersion={apiKeyVersion}
      search={search}
      onChangeApiKey={clearApiKey}
    />
  );
}

type AuthenticatedRecordsDashboardProps = {
  apiKey: string;
  apiKeyVersion: number;
  search: RecordsRouteSearch;
  onChangeApiKey: () => void;
};

function AuthenticatedRecordsDashboard({
  apiKey,
  apiKeyVersion,
  search,
  onChangeApiKey,
}: AuthenticatedRecordsDashboardProps) {
  const navigate = useNavigate({ from: '/' });
  const activeTab = search.tab ?? 'records';
  const recordsInput = toRecordsQueryInput(search);
  const recordsQuery = useInfiniteQuery({
    queryKey: ['records', apiKeyVersion, recordsInput],
    queryFn: ({ pageParam }) => listRecords({ ...recordsInput, offset: pageParam }, apiKey),
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
    queryKey: ['data-sources', apiKeyVersion],
    queryFn: () => listDataSources(apiKey),
    retry: false,
  });
  const peopleQuery = useInfiniteQuery({
    queryKey: ['people', apiKeyVersion, DEFAULT_PEOPLE_SORT_FIELD, DEFAULT_PEOPLE_SORT_ORDER],
    queryFn: ({ pageParam }) =>
      listPeople(apiKey, {
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
              onClick={() => updateSearch({ tab: 'knowledge' })}
            >
              <BookOpen />
              Knowledge
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={onChangeApiKey}>
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
              apiKey={apiKey}
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
                  <ErrorState error={recordsQuery.error} onChangeApiKey={onChangeApiKey} />
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
          apiKey={apiKey}
          people={people}
          total={peopleTotal}
          isLoading={peopleQuery.isLoading}
          isFetching={peopleQuery.isFetching && !peopleQuery.isFetchingNextPage}
          isFetchingNextPage={peopleQuery.isFetchingNextPage}
          hasNextPage={peopleQuery.hasNextPage}
          fetchNextPage={peopleQuery.fetchNextPage}
          error={peopleQuery.error}
          onChangeApiKey={onChangeApiKey}
        />
      ) : null}

      {activeTab === 'knowledge' ? (
        <KnowledgeExplorer
          apiKey={apiKey}
          apiKeyVersion={apiKeyVersion}
          search={search}
          onChange={updateSearch}
          onChangeApiKey={onChangeApiKey}
        />
      ) : null}
    </main>
  );
}

function descriptionForTab(activeTab: string, peopleTotal: number, recordsTotal: number) {
  switch (activeTab) {
    case 'people':
      return `${peopleTotal.toLocaleString()} people ranked by records`;
    case 'knowledge':
      return 'Knowledge pages';
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

function ErrorState({ error, onChangeApiKey }: { error: Error; onChangeApiKey: () => void }) {
  const isAuthError = error instanceof BrainApiError && error.status === HTTP_UNAUTHORIZED;

  return (
    <div className="grid min-h-72 place-items-center p-8 text-center">
      <div className="max-w-xl">
        <h2 className="font-semibold">Could not load records</h2>
        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
        {isAuthError ? (
          <Button type="button" className="mt-4" onClick={onChangeApiKey}>
            <KeyRound />
            Enter API key
          </Button>
        ) : null}
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
