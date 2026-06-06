import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { KeyRound, Loader2, RefreshCw, Search } from 'lucide-react';
import {
  type FormEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card } from '#/components/ui/card.tsx';
import { Input } from '#/components/ui/input.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import {
  BrainApiError,
  createKnowledgeBrowserSession,
  type KnowledgePreview,
  listKnowledge,
} from '#/lib/brain-functions.ts';
import { DEFAULT_LIMIT, EMPTY_COUNT, EMPTY_OFFSET, HTTP_UNAUTHORIZED } from '#/lib/constants.ts';
import type { RecordsRouteSearch } from '#/lib/records-search.ts';
import { useInfiniteScroll } from '#/lib/use-infinite-scroll.ts';
import { cn } from '#/lib/utils.ts';

type KnowledgeExplorerProps = {
  apiKey: string;
  apiKeyVersion: number;
  search: RecordsRouteSearch;
  onChange: (next: Partial<RecordsRouteSearch>) => void;
  onChangeApiKey: () => void;
};

const KNOWLEDGE_PAGE_PATH_PATTERN =
  /^\/knowledge\/pages\/(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const LOADING_ITEMS = ['knowledge-a', 'knowledge-b', 'knowledge-c', 'knowledge-d', 'knowledge-e'];

export function KnowledgeExplorer({
  apiKey,
  apiKeyVersion,
  search,
  onChange,
  onChangeApiKey,
}: KnowledgeExplorerProps) {
  const [draft, setDraft] = useState(search.knowledgeQ ?? '');
  const sessionQuery = useQuery({
    queryKey: ['knowledge-browser-session', apiKeyVersion],
    queryFn: () => createKnowledgeBrowserSession(apiKey),
    retry: false,
  });
  const knowledgeQuery = useInfiniteQuery({
    queryKey: ['knowledge', apiKeyVersion, search.knowledgeQ ?? ''],
    queryFn: ({ pageParam }) =>
      listKnowledge(apiKey, {
        q: search.knowledgeQ,
        limit: DEFAULT_LIMIT,
        offset: pageParam,
      }),
    initialPageParam: EMPTY_OFFSET,
    getNextPageParam: (lastPage, allPages) => {
      const total = allPages[EMPTY_COUNT]?.total ?? EMPTY_COUNT;
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < total ? nextOffset : undefined;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  useEffect(() => {
    setDraft(search.knowledgeQ ?? '');
  }, [search.knowledgeQ]);

  const knowledge = useMemo(
    () => knowledgeQuery.data?.pages.flatMap((page) => page.results) ?? [],
    [knowledgeQuery.data],
  );
  const selectedKnowledge = selectedKnowledgeFor(knowledge, search.selectedKnowledgeId);
  const selectedKnowledgeId = search.selectedKnowledgeId ?? selectedKnowledge?.id;
  const total = knowledgeQuery.data?.pages[EMPTY_COUNT]?.total ?? EMPTY_COUNT;
  const { scrollRef, sentinelRef } = useInfiniteScroll({
    hasNextPage: knowledgeQuery.hasNextPage,
    isFetchingNextPage: knowledgeQuery.isFetchingNextPage,
    fetchNextPage: knowledgeQuery.fetchNextPage,
  });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onChange({
      tab: 'knowledge',
      knowledgeQ: draft.trim() || undefined,
      selectedKnowledgeId: undefined,
    });
  };

  const handleFrameLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const id = knowledgeIdFromFrame(event.currentTarget);
    if (id && id !== search.selectedKnowledgeId) {
      onChange({ tab: 'knowledge', selectedKnowledgeId: id });
    }
  };

  return (
    <section className="grid min-h-0 flex-1 grid-rows-[16rem_minmax(0,1fr)] gap-4 overflow-hidden p-4 md:grid-cols-[23rem_minmax(0,1fr)] md:grid-rows-1">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
          <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={submitSearch}>
            <Input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search knowledge"
            />
            <Button type="submit" size="icon" title="Search knowledge">
              <Search />
            </Button>
          </form>
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Refresh session"
            onClick={() => void sessionQuery.refetch()}
          >
            <RefreshCw />
          </Button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-2">
          {knowledgeQuery.isLoading ? (
            <LoadingKnowledgeItems />
          ) : knowledgeQuery.isError ? (
            <PanelError
              title="Could not load knowledge"
              error={knowledgeQuery.error}
              onChangeApiKey={onChangeApiKey}
            />
          ) : knowledge.length === EMPTY_COUNT ? (
            <div className="grid h-full min-h-32 place-items-center p-4 text-center text-muted-foreground text-sm">
              No knowledge found.
            </div>
          ) : (
            <div className="grid gap-1">
              {knowledge.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'min-h-12 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    item.id === selectedKnowledgeId && 'bg-secondary text-secondary-foreground',
                  )}
                  onClick={() => onChange({ tab: 'knowledge', selectedKnowledgeId: item.id })}
                >
                  <span className="block overflow-hidden text-ellipsis break-words leading-snug">
                    {item.title}
                  </span>
                </button>
              ))}
              <div ref={sentinelRef} />
              {knowledgeQuery.isFetchingNextPage ? <LoadingMore /> : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 text-muted-foreground text-sm">
          <span>
            Showing {knowledge.length.toLocaleString()} of {total.toLocaleString()}
          </span>
        </div>
      </Card>

      <Card className="flex h-full min-h-0 overflow-hidden">
        {sessionQuery.isLoading ? (
          <FrameState
            icon={<Loader2 className="size-5 animate-spin" />}
            text="Opening session..."
          />
        ) : sessionQuery.isError ? (
          <PanelError
            title="Could not open session"
            error={sessionQuery.error}
            onChangeApiKey={onChangeApiKey}
          />
        ) : selectedKnowledgeId ? (
          <iframe
            key={selectedKnowledgeId}
            title={selectedKnowledge?.title ?? 'Knowledge page'}
            src={knowledgePageSrc(selectedKnowledgeId)}
            className="h-full min-h-0 w-full border-0 bg-background"
            referrerPolicy="no-referrer"
            onLoad={handleFrameLoad}
          />
        ) : (
          <FrameState text="No knowledge selected." />
        )}
      </Card>
    </section>
  );
}

function selectedKnowledgeFor(knowledge: KnowledgePreview[], selectedId: string | undefined) {
  return knowledge.find((item) => item.id === selectedId) ?? knowledge[EMPTY_COUNT] ?? null;
}

function knowledgePageSrc(id: string) {
  return `/knowledge/pages/${id}`;
}

function knowledgeIdFromFrame(frame: HTMLIFrameElement) {
  try {
    const path = frame.contentWindow?.location.pathname;
    return path?.match(KNOWLEDGE_PAGE_PATH_PATTERN)?.groups?.id;
  } catch {
    return undefined;
  }
}

function LoadingKnowledgeItems() {
  return (
    <div className="grid gap-2">
      {LOADING_ITEMS.map((key) => (
        <Skeleton key={key} className="h-12 w-full" />
      ))}
    </div>
  );
}

function LoadingMore() {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" />
      Loading more...
    </div>
  );
}

function FrameState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="grid h-full min-h-0 flex-1 place-items-center p-8 text-muted-foreground text-sm">
      <div className="flex items-center gap-2">
        {icon}
        <span>{text}</span>
      </div>
    </div>
  );
}

function PanelError({
  title,
  error,
  onChangeApiKey,
}: {
  title: string;
  error: Error;
  onChangeApiKey: () => void;
}) {
  const isAuthError = error instanceof BrainApiError && error.status === HTTP_UNAUTHORIZED;

  return (
    <div className="grid h-full min-h-0 flex-1 place-items-center p-8 text-center">
      <div className="max-w-xl">
        <h2 className="font-semibold">{title}</h2>
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
