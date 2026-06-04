import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Pencil, Save, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '#/components/ui/badge.tsx';
import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent } from '#/components/ui/card.tsx';
import { Input } from '#/components/ui/input.tsx';
import { Label } from '#/components/ui/label.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx';
import { participantLabel } from '#/features/records/record-format.ts';
import {
  BrainApiError,
  type Person,
  type PersonUpdateInput,
  updatePerson,
} from '#/lib/brain-functions.ts';
import { EMPTY_COUNT, HTTP_UNAUTHORIZED } from '#/lib/constants.ts';
import { useInfiniteScroll } from '#/lib/use-infinite-scroll.ts';

type PeopleManagerProps = {
  apiKey: string;
  people: Person[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  onChangeApiKey: () => void;
};

type PersonDraft = {
  name: string;
  email: string;
  is_external: boolean;
};

const SOURCE_BADGE_LIMIT = 3;
const LOADING_ROW_KEYS = [
  'people-loading-row-a',
  'people-loading-row-b',
  'people-loading-row-c',
  'people-loading-row-d',
  'people-loading-row-e',
  'people-loading-row-f',
];

export function PeopleManager({
  apiKey,
  people,
  total,
  isLoading,
  isFetching,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  error,
  onChangeApiKey,
}: PeopleManagerProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState<PersonDraft>();
  const [statusMessage, setStatusMessage] = useState<string>();

  const sentinelRef = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PersonUpdateInput }) =>
      updatePerson(id, updates, apiKey),
    onSuccess: (person) => {
      setEditingId(undefined);
      setDraft(undefined);
      setStatusMessage(`Saved ${participantLabel(person)}.`);
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      void queryClient.invalidateQueries({ queryKey: ['people-search'] });
      void queryClient.invalidateQueries({ queryKey: ['person', person.id] });
      void queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });

  if (isLoading) {
    return (
      <section className="p-4">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-3 p-4">
            {LOADING_ROW_KEYS.map((key) => (
              <Skeleton key={key} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-4">
        <Card>
          <CardContent className="grid min-h-72 place-items-center p-8 text-center">
            <div className="max-w-xl">
              <h2 className="font-semibold">Could not load people</h2>
              <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
              {error instanceof BrainApiError && error.status === HTTP_UNAUTHORIZED ? (
                <Button type="button" className="mt-4" onClick={onChangeApiKey}>
                  <KeyRound />
                  Enter API key
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="p-4">
      <Card className="overflow-hidden">
        {total === EMPTY_COUNT ? (
          <div className="grid min-h-72 place-items-center p-8 text-center text-muted-foreground text-sm">
            No people found.
          </div>
        ) : (
          <>
            <PeopleTable
              people={people}
              editingId={editingId}
              draft={draft}
              savingId={updateMutation.isPending ? updateMutation.variables?.id : undefined}
              onEdit={(person) => {
                setEditingId(person.id);
                setDraft(draftFromPerson(person));
                setStatusMessage(undefined);
              }}
              onCancel={() => {
                setEditingId(undefined);
                setDraft(undefined);
              }}
              onChangeDraft={setDraft}
              onSave={(person, nextDraft) => {
                updateMutation.mutate({ id: person.id, updates: updateFromDraft(nextDraft) });
              }}
            />
            <div ref={sentinelRef} />
            {isFetchingNextPage ? (
              <div className="flex items-center justify-center gap-2 border-t py-4 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading more...
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
              <StatusLine
                isFetching={isFetching}
                statusMessage={statusMessage}
                error={updateMutation.error}
                loaded={people.length}
                total={total}
              />
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function PeopleTable({
  people,
  editingId,
  draft,
  savingId,
  onEdit,
  onCancel,
  onChangeDraft,
  onSave,
}: {
  people: Person[];
  editingId?: string;
  draft?: PersonDraft;
  savingId?: string;
  onEdit: (person: Person) => void;
  onCancel: () => void;
  onChangeDraft: (draft: PersonDraft) => void;
  onSave: (person: Person, draft: PersonDraft) => void;
}) {
  return (
    <Table className="min-w-[68rem] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[19rem]">Person</TableHead>
          <TableHead className="w-[18rem]">Email</TableHead>
          <TableHead className="w-[8rem]">Type</TableHead>
          <TableHead className="w-[7rem] text-right">Records</TableHead>
          <TableHead>Sources</TableHead>
          <TableHead className="w-[10rem]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) =>
          editingId === person.id && draft ? (
            <PersonEditRow
              key={person.id}
              person={person}
              draft={draft}
              isSaving={savingId === person.id}
              onChangeDraft={onChangeDraft}
              onCancel={onCancel}
              onSave={onSave}
            />
          ) : (
            <PersonReadRow key={person.id} person={person} onEdit={onEdit} />
          ),
        )}
      </TableBody>
    </Table>
  );
}

function PersonReadRow({ person, onEdit }: { person: Person; onEdit: (person: Person) => void }) {
  return (
    <TableRow>
      <TableCell>
        <div className="grid gap-1">
          <span className={person.name ? '' : 'text-muted-foreground'}>{person.name ?? '—'}</span>
          <span className="truncate font-mono text-muted-foreground text-xs" title={person.id}>
            {person.id}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className={person.email ? 'truncate' : 'text-muted-foreground'}>
          {person.email ?? '—'}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={person.is_external ? 'secondary' : 'outline'}>
          {person.is_external ? 'External' : 'Internal'}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-medium">
        {person.records_count.toLocaleString()}
      </TableCell>
      <TableCell>
        <PersonSources person={person} />
      </TableCell>
      <TableCell>
        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(person)}>
          <Pencil />
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

function PersonEditRow({
  person,
  draft,
  isSaving,
  onChangeDraft,
  onCancel,
  onSave,
}: {
  person: Person;
  draft: PersonDraft;
  isSaving: boolean;
  onChangeDraft: (draft: PersonDraft) => void;
  onCancel: () => void;
  onSave: (person: Person, draft: PersonDraft) => void;
}) {
  const canSave = hasDraftChanges(person, draft);
  return (
    <TableRow>
      <TableCell>
        <div className="grid gap-1">
          <Input
            value={draft.name}
            placeholder="Name"
            onChange={(event) => {
              onChangeDraft({ ...draft, name: event.target.value });
            }}
          />
          <span className="truncate font-mono text-muted-foreground text-xs" title={person.id}>
            {person.id}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="email"
          value={draft.email}
          placeholder="Email"
          onChange={(event) => {
            onChangeDraft({ ...draft, email: event.target.value });
          }}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <input
            id={`person-external-${person.id}`}
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            checked={draft.is_external}
            onChange={(event) => {
              onChangeDraft({ ...draft, is_external: event.target.checked });
            }}
          />
          <Label htmlFor={`person-external-${person.id}`}>External</Label>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium">
        {person.records_count.toLocaleString()}
      </TableCell>
      <TableCell>
        <PersonSources person={person} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!canSave || isSaving}
            onClick={() => {
              onSave(person, draft);
            }}
          >
            <Save />
            {isSaving ? 'Saving' : 'Save'}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Cancel"
            disabled={isSaving}
            onClick={onCancel}
          >
            <X />
            <span className="sr-only">Cancel</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function PersonSources({ person }: { person: Person }) {
  const visibleSources = person.data_sources.slice(EMPTY_COUNT, SOURCE_BADGE_LIMIT);
  const overflow = person.data_sources.length - visibleSources.length;

  if (person.data_sources.length === EMPTY_COUNT) {
    return <span className="text-muted-foreground text-sm">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {visibleSources.map((source) => (
        <Badge
          key={`${source.data_source_key}:${source.data_source_user_id}`}
          variant="secondary"
          className="max-w-full"
        >
          <span className="truncate">
            {source.data_source_key}:{source.data_source_user_id}
          </span>
        </Badge>
      ))}
      {overflow > EMPTY_COUNT ? (
        <Badge variant="outline">+{overflow.toLocaleString()}</Badge>
      ) : null}
    </div>
  );
}

function StatusLine({
  isFetching,
  statusMessage,
  error,
  loaded,
  total,
}: {
  isFetching: boolean;
  statusMessage?: string;
  error: Error | null;
  loaded: number;
  total: number;
}) {
  if (error) {
    return <span className="text-destructive">{error.message}</span>;
  }

  if (statusMessage) {
    return <span className="text-muted-foreground">{statusMessage}</span>;
  }

  if (isFetching) {
    return <span className="text-muted-foreground">Refreshing people...</span>;
  }

  return (
    <span className="text-muted-foreground">
      Showing {loaded.toLocaleString()} of {total.toLocaleString()}
    </span>
  );
}

function draftFromPerson(person: Person): PersonDraft {
  return {
    name: person.name ?? '',
    email: person.email ?? '',
    is_external: person.is_external,
  };
}

function updateFromDraft(draft: PersonDraft): PersonUpdateInput {
  return {
    name: nullableText(draft.name),
    email: nullableText(draft.email),
    is_external: draft.is_external,
  };
}

function hasDraftChanges(person: Person, draft: PersonDraft) {
  const updates = updateFromDraft(draft);
  return (
    updates.name !== person.name ||
    updates.email !== person.email ||
    updates.is_external !== person.is_external
  );
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > EMPTY_COUNT ? trimmed : null;
}
