import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, Folder, Home, KeyRound, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '#/components/ui/badge.tsx';
import { Button } from '#/components/ui/button.tsx';
import { Card } from '#/components/ui/card.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import {
  formatDateTime,
  participantLabel,
  recordPreview,
  recordTitle,
} from '#/features/records/record-format.ts';
import { RecordPreview } from '#/features/records/record-preview.tsx';
import {
  BrainApiError,
  listRecordFilesystem,
  type RecordFilesystemFolder,
  type RecordHit,
} from '#/lib/brain-functions.ts';
import { EMPTY_COUNT, EMPTY_OFFSET, HTTP_UNAUTHORIZED } from '#/lib/constants.ts';
import { type RecordsRouteSearch, toRecordFilesystemInput } from '#/lib/records-search.ts';
import { useInfiniteScroll } from '#/lib/use-infinite-scroll.ts';

type RecordsFileBrowserProps = {
  apiKey: string;
  apiKeyVersion: number;
  search: RecordsRouteSearch;
  onChange: (next: Partial<RecordsRouteSearch>) => void;
  onChangeApiKey: () => void;
};

const LOADING_ITEM_KEYS = [
  'filesystem-loading-a',
  'filesystem-loading-b',
  'filesystem-loading-c',
  'filesystem-loading-d',
  'filesystem-loading-e',
  'filesystem-loading-f',
  'filesystem-loading-g',
  'filesystem-loading-h',
];

const PARTICIPANT_PREVIEW_LIMIT = 3;

export function RecordsFileBrowser({
  apiKey,
  apiKeyVersion,
  search,
  onChange,
  onChangeApiKey,
}: RecordsFileBrowserProps) {
  const input = toRecordFilesystemInput(search);
  const isRecordFolder = Boolean(input.dataSourceId && input.day && input.personId);
  const browserQuery = useInfiniteQuery({
    queryKey: ['record-filesystem', apiKeyVersion, input],
    queryFn: ({ pageParam }) => listRecordFilesystem({ ...input, offset: pageParam }, apiKey),
    initialPageParam: EMPTY_OFFSET,
    getNextPageParam: (lastPage, allPages) => {
      if (!isRecordFolder) {
        return undefined;
      }
      const loaded = allPages.reduce((sum, page) => sum + page.records.length, EMPTY_COUNT);
      return loaded < lastPage.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  const firstPage = browserQuery.data?.pages[EMPTY_COUNT];
  const folders = firstPage?.folders ?? [];
  const records = useMemo(
    () => browserQuery.data?.pages.flatMap((page) => page.records) ?? [],
    [browserQuery.data],
  );
  const total = firstPage?.total ?? EMPTY_COUNT;
  const selectedRecord = selectedRecordFor(records, search.selectedRecordId);
  const { scrollRef, sentinelRef } = useInfiniteScroll({
    hasNextPage: browserQuery.hasNextPage,
    isFetchingNextPage: browserQuery.isFetchingNextPage,
    fetchNextPage: browserQuery.fetchNextPage,
  });

  const openFolder = (folder: RecordFilesystemFolder) => {
    if (folder.type === 'provider') {
      onChange({
        fsDataSourceId: folder.id,
        fsDay: undefined,
        fsPersonId: undefined,
        selectedRecordId: undefined,
      });
      return;
    }
    if (folder.type === 'day') {
      onChange({
        fsDay: folder.id,
        fsPersonId: undefined,
        selectedRecordId: undefined,
      });
      return;
    }
    onChange({ fsPersonId: folder.id, selectedRecordId: undefined });
  };

  return (
    <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(30rem,0.95fr)_minmax(34rem,1.05fr)] xl:grid-rows-1">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b px-4 py-3">
          <Breadcrumbs path={firstPage?.path} search={search} onChange={onChange} />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
            <Badge variant="outline">{total.toLocaleString()} records</Badge>
            <span>
              {isRecordFolder
                ? `${records.length.toLocaleString()} files`
                : `${folders.length.toLocaleString()} folders`}
            </span>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          {browserQuery.isLoading ? (
            <LoadingItems />
          ) : browserQuery.isError ? (
            <ErrorState error={browserQuery.error} onChangeApiKey={onChangeApiKey} />
          ) : folders.length > EMPTY_COUNT ? (
            <FolderList folders={folders} onOpenFolder={openFolder} />
          ) : records.length > EMPTY_COUNT ? (
            <>
              <RecordList
                records={records}
                selectedRecordId={selectedRecord?.id}
                onSelectRecord={(id) => onChange({ selectedRecordId: id })}
              />
              <div ref={sentinelRef} />
              {browserQuery.isFetchingNextPage ? <LoadingMore /> : null}
            </>
          ) : (
            <EmptyState isRecordFolder={isRecordFolder} />
          )}
        </div>
      </Card>

      <RecordPreview record={selectedRecord} />
    </section>
  );
}

function Breadcrumbs({
  path,
  search,
  onChange,
}: {
  path:
    | {
        data_source_key?: string;
        day?: string;
        participant_name?: string;
      }
    | undefined;
  search: RecordsRouteSearch;
  onChange: (next: Partial<RecordsRouteSearch>) => void;
}) {
  const sourceLabel = path?.data_source_key ?? (search.fsDataSourceId ? 'Provider' : undefined);
  const dayLabel = path?.day ?? search.fsDay;
  const participantName =
    path?.participant_name ?? (search.fsPersonId ? search.fsPersonId : undefined);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-2"
        onClick={() =>
          onChange({
            fsDataSourceId: undefined,
            fsDay: undefined,
            fsPersonId: undefined,
            selectedRecordId: undefined,
          })
        }
      >
        <Home />
        Root
      </Button>
      {sourceLabel ? (
        <BreadcrumbSegment
          label={sourceLabel}
          onClick={() =>
            onChange({
              fsDay: undefined,
              fsPersonId: undefined,
              selectedRecordId: undefined,
            })
          }
        />
      ) : null}
      {dayLabel ? (
        <BreadcrumbSegment
          label={formatDayLabel(dayLabel)}
          onClick={() => onChange({ fsPersonId: undefined, selectedRecordId: undefined })}
        />
      ) : null}
      {participantName ? <BreadcrumbSegment label={participantName} /> : null}
    </div>
  );
}

function BreadcrumbSegment({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      {onClick ? (
        <Button type="button" variant="ghost" size="sm" className="min-w-0 px-2" onClick={onClick}>
          <span className="truncate">{label}</span>
        </Button>
      ) : (
        <span className="min-w-0 truncate px-2 font-medium text-sm">{label}</span>
      )}
    </>
  );
}

function FolderList({
  folders,
  onOpenFolder,
}: {
  folders: RecordFilesystemFolder[];
  onOpenFolder: (folder: RecordFilesystemFolder) => void;
}) {
  return (
    <div className="divide-y">
      {folders.map((folder) => (
        <button
          key={`${folder.type}:${folder.id}`}
          type="button"
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          onClick={() => onOpenFolder(folder)}
        >
          <Folder className="size-5 text-primary" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{folderLabel(folder)}</span>
            <span className="block truncate text-muted-foreground text-xs">
              {folderSecondaryLabel(folder)}
            </span>
          </span>
          <Badge variant="secondary">{folder.count.toLocaleString()}</Badge>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function RecordList({
  records,
  selectedRecordId,
  onSelectRecord,
}: {
  records: RecordHit[];
  selectedRecordId: string | undefined;
  onSelectRecord: (id: string) => void;
}) {
  return (
    <div className="divide-y">
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          data-state={record.id === selectedRecordId ? 'selected' : undefined}
          className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=selected]:bg-muted"
          onClick={() => onSelectRecord(record.id)}
        >
          <FileText className="mt-0.5 size-5 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{recordTitle(record)}</span>
            <span className="mt-1 line-clamp-2 text-muted-foreground text-xs">
              {recordPreview(record)}
            </span>
            <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="outline">{record.data_source_key}</Badge>
              <span className="text-muted-foreground text-xs">
                {formatDateTime(record.created_at)}
              </span>
              {record.participants.slice(0, PARTICIPANT_PREVIEW_LIMIT).map((participant) => (
                <Badge key={participant.id} variant="secondary" className="max-w-44">
                  <span className="truncate">{participantLabel(participant)}</span>
                </Badge>
              ))}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function LoadingItems() {
  return (
    <div className="grid gap-3 p-4">
      {LOADING_ITEM_KEYS.map((key) => (
        <Skeleton key={key} className="h-16 w-full" />
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
        <h2 className="font-semibold">Could not load filesystem</h2>
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

function EmptyState({ isRecordFolder }: { isRecordFolder: boolean }) {
  return (
    <div className="grid min-h-72 place-items-center p-8 text-center text-muted-foreground text-sm">
      {isRecordFolder ? 'No records found.' : 'No folders found.'}
    </div>
  );
}

function selectedRecordFor(records: RecordHit[], selectedRecordId: string | undefined) {
  return records.find((record) => record.id === selectedRecordId) ?? records[EMPTY_COUNT] ?? null;
}

function folderLabel(folder: RecordFilesystemFolder) {
  return folder.type === 'day' ? formatDayLabel(folder.id) : folder.name;
}

function folderSecondaryLabel(folder: RecordFilesystemFolder) {
  if (folder.type === 'provider') {
    return 'Provider';
  }
  if (folder.type === 'day') {
    return folder.id;
  }
  return 'Participant';
}

function formatDayLabel(day: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}
