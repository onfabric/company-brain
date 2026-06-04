import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Command, CommandInput, CommandItem, CommandList } from '#/components/ui/command.tsx';
import { Label } from '#/components/ui/label.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover.tsx';
import { participantLabel } from '#/features/records/record-format.ts';
import { getPerson, listPeople } from '#/lib/brain-functions.ts';
import {
  DEFAULT_PEOPLE_SORT_FIELD,
  DEFAULT_PEOPLE_SORT_ORDER,
  EMPTY_COUNT,
  PARTICIPANT_SEARCH_LIMIT,
  SEARCH_DEBOUNCE_MS,
} from '#/lib/constants.ts';
import { cn } from '#/lib/utils.ts';

type ParticipantFilterProps = {
  apiKey: string;
  personId?: string;
  onSelect: (personId: string | undefined) => void;
};

export function ParticipantFilter({ apiKey, personId, onSelect }: ParticipantFilterProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input, SEARCH_DEBOUNCE_MS);

  const searchQuery = useQuery({
    queryKey: ['people-search', query],
    queryFn: () =>
      listPeople(apiKey, {
        query: query || undefined,
        limit: PARTICIPANT_SEARCH_LIMIT,
        sortBy: DEFAULT_PEOPLE_SORT_FIELD,
        sortOrder: DEFAULT_PEOPLE_SORT_ORDER,
      }),
    enabled: open,
  });

  const selectedQuery = useQuery({
    queryKey: ['person', personId],
    queryFn: () => getPerson(personId ?? '', apiKey),
    enabled: Boolean(personId),
  });

  const results = searchQuery.data?.people ?? [];
  const selectedLabel = selectedQuery.data ? participantLabel(selectedQuery.data) : undefined;

  const choose = (nextPersonId: string | undefined) => {
    onSelect(nextPersonId);
    setOpen(false);
    setInput('');
  };

  return (
    <div className="grid gap-2">
      <Label>Participant</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between font-normal"
          >
            <span className={cn('truncate', personId ? '' : 'text-muted-foreground')}>
              {personId ? (selectedLabel ?? 'Selected person') : 'All people'}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search people..." value={input} onValueChange={setInput} />
            <CommandList>
              <CommandItem value="__all__" onSelect={() => choose(undefined)}>
                <Check className={cn('size-4', personId ? 'opacity-0' : 'opacity-100')} />
                All people
              </CommandItem>
              {searchQuery.isFetching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Searching...
                </div>
              ) : results.length === EMPTY_COUNT ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  No people found.
                </div>
              ) : (
                results.map((person) => (
                  <CommandItem key={person.id} value={person.id} onSelect={() => choose(person.id)}>
                    <Check
                      className={cn('size-4', personId === person.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="truncate">{participantLabel(person)}</span>
                  </CommandItem>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
