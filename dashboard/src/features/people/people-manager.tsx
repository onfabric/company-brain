import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, KeyRound, Save, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '#/components/ui/badge.tsx';
import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent } from '#/components/ui/card.tsx';
import { Input } from '#/components/ui/input.tsx';
import { Label } from '#/components/ui/label.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx';
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
  mergePeople,
  type Person,
  type PersonUpdateInput,
  updatePerson,
} from '#/lib/brain-functions.ts';
import { EMPTY_COUNT, HTTP_UNAUTHORIZED } from '#/lib/constants.ts';

type PeopleManagerProps = {
  apiKey: string;
  people: Person[];
  isLoading: boolean;
  isFetching: boolean;
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
  isLoading,
  isFetching,
  error,
  onChangeApiKey,
}: PeopleManagerProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, PersonDraft>>({});
  const [mergeFromId, setMergeFromId] = useState<string>();
  const [mergeIntoId, setMergeIntoId] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();

  const sourceOptions = useMemo(
    () => people.filter((person) => person.name === null && person.email === null),
    [people],
  );
  const mergeFromPerson =
    sourceOptions.find((person) => person.id === mergeFromId) ?? sourceOptions[EMPTY_COUNT];
  const targetOptions = useMemo(
    () => people.filter((person) => person.id !== mergeFromPerson?.id),
    [mergeFromPerson?.id, people],
  );
  const mergeIntoPerson =
    targetOptions.find((person) => person.id === mergeIntoId) ?? targetOptions[EMPTY_COUNT];

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PersonUpdateInput }) =>
      updatePerson(id, updates, apiKey),
    onSuccess: (person) => {
      setDrafts((current) => ({ ...current, [person.id]: draftFromPerson(person) }));
      setStatusMessage(`Saved ${participantLabel(person)}.`);
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      void queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({
      mergeFromId: sourceId,
      mergeIntoId: targetId,
    }: {
      mergeFromId: string;
      mergeIntoId: string;
    }) => mergePeople({ mergeFromId: sourceId, mergeIntoId: targetId }, apiKey),
    onSuccess: (result) => {
      setMergeFromId(undefined);
      setMergeIntoId(result.person.id);
      setStatusMessage(
        `Merged ${result.moved_records.toLocaleString()} records into ${participantLabel(result.person)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      void queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });

  const mutationError = updateMutation.error ?? mergeMutation.error;

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
        <CardContent className="border-b p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto] lg:items-end">
            <div className="grid gap-2">
              <Label htmlFor="merge-from">Merge from</Label>
              <Select
                value={mergeFromPerson?.id}
                onValueChange={setMergeFromId}
                disabled={sourceOptions.length === EMPTY_COUNT || mergeMutation.isPending}
              >
                <SelectTrigger id="merge-from">
                  <SelectValue placeholder="No unresolved people" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {personOptionLabel(person)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="merge-into">Merge into</Label>
              <Select
                value={mergeIntoPerson?.id}
                onValueChange={setMergeIntoId}
                disabled={targetOptions.length === EMPTY_COUNT || mergeMutation.isPending}
              >
                <SelectTrigger id="merge-into">
                  <SelectValue placeholder="No target person" />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {personOptionLabel(person)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              className="lg:w-32"
              disabled={!mergeFromPerson || !mergeIntoPerson || mergeMutation.isPending}
              onClick={() => {
                if (!mergeFromPerson || !mergeIntoPerson) {
                  return;
                }
                mergeMutation.mutate({
                  mergeFromId: mergeFromPerson.id,
                  mergeIntoId: mergeIntoPerson.id,
                });
              }}
            >
              <ArrowRightLeft />
              {mergeMutation.isPending ? 'Merging' : 'Merge'}
            </Button>
          </div>

          <StatusLine isFetching={isFetching} statusMessage={statusMessage} error={mutationError} />
        </CardContent>

        {people.length === EMPTY_COUNT ? (
          <div className="grid min-h-72 place-items-center p-8 text-center text-muted-foreground text-sm">
            No people found.
          </div>
        ) : (
          <PeopleTable
            people={people}
            drafts={drafts}
            savingId={updateMutation.isPending ? updateMutation.variables?.id : undefined}
            mergeFromId={mergeFromPerson?.id}
            mergeIntoId={mergeIntoPerson?.id}
            onChangeDraft={(id, draft) => {
              setDrafts((current) => ({ ...current, [id]: draft }));
            }}
            onResetDraft={(person) => {
              setDrafts((current) => ({ ...current, [person.id]: draftFromPerson(person) }));
            }}
            onSave={(person, draft) => {
              updateMutation.mutate({ id: person.id, updates: updateFromDraft(draft) });
            }}
            onSelectMergeFrom={(id) => {
              setMergeFromId(id);
            }}
            onSelectMergeInto={(id) => {
              setMergeIntoId(id);
            }}
          />
        )}
      </Card>
    </section>
  );
}

function PeopleTable({
  people,
  drafts,
  savingId,
  mergeFromId,
  mergeIntoId,
  onChangeDraft,
  onResetDraft,
  onSave,
  onSelectMergeFrom,
  onSelectMergeInto,
}: {
  people: Person[];
  drafts: Record<string, PersonDraft>;
  savingId?: string;
  mergeFromId?: string;
  mergeIntoId?: string;
  onChangeDraft: (id: string, draft: PersonDraft) => void;
  onResetDraft: (person: Person) => void;
  onSave: (person: Person, draft: PersonDraft) => void;
  onSelectMergeFrom: (id: string) => void;
  onSelectMergeInto: (id: string) => void;
}) {
  return (
    <Table className="min-w-[76rem] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[19rem]">Person</TableHead>
          <TableHead className="w-[18rem]">Email</TableHead>
          <TableHead className="w-[8rem]">Type</TableHead>
          <TableHead className="w-[7rem] text-right">Records</TableHead>
          <TableHead>Sources</TableHead>
          <TableHead className="w-[16rem]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => {
          const draft = drafts[person.id] ?? draftFromPerson(person);
          const canSave = hasDraftChanges(person, draft);
          const canMergeFrom = person.name === null && person.email === null;
          return (
            <TableRow key={person.id}>
              <TableCell>
                <div className="grid gap-1">
                  <Input
                    value={draft.name}
                    placeholder="Name"
                    onChange={(event) => {
                      onChangeDraft(person.id, { ...draft, name: event.target.value });
                    }}
                  />
                  <span
                    className="truncate font-mono text-muted-foreground text-xs"
                    title={person.id}
                  >
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
                    onChangeDraft(person.id, { ...draft, email: event.target.value });
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
                      onChangeDraft(person.id, {
                        ...draft,
                        is_external: event.target.checked,
                      });
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
                    disabled={!canSave || savingId === person.id}
                    onClick={() => {
                      onSave(person, draft);
                    }}
                  >
                    <Save />
                    {savingId === person.id ? 'Saving' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title="Reset"
                    disabled={!canSave || savingId === person.id}
                    onClick={() => {
                      onResetDraft(person);
                    }}
                  >
                    <Undo2 />
                    <span className="sr-only">Reset</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mergeFromId === person.id ? 'secondary' : 'outline'}
                    disabled={!canMergeFrom}
                    onClick={() => {
                      onSelectMergeFrom(person.id);
                    }}
                  >
                    From
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mergeIntoId === person.id ? 'secondary' : 'outline'}
                    onClick={() => {
                      onSelectMergeInto(person.id);
                    }}
                  >
                    Into
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
}: {
  isFetching: boolean;
  statusMessage?: string;
  error: Error | null;
}) {
  if (error) {
    return <p className="mt-3 text-destructive text-sm">{error.message}</p>;
  }

  if (statusMessage) {
    return <p className="mt-3 text-muted-foreground text-sm">{statusMessage}</p>;
  }

  if (isFetching) {
    return <p className="mt-3 text-muted-foreground text-sm">Refreshing people...</p>;
  }

  return null;
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

function personOptionLabel(person: Person) {
  return `${participantLabel(person)} (${person.records_count.toLocaleString()})`;
}
