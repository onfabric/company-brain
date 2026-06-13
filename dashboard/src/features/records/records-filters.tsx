import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '#/components/ui/badge.tsx';
import { Button } from '#/components/ui/button.tsx';
import { Input } from '#/components/ui/input.tsx';
import { Label } from '#/components/ui/label.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx';
import { ParticipantFilter } from '#/features/records/participant-filter.tsx';
import type { Source } from '#/lib/brain-functions.ts';
import { DEFAULT_LIMIT, EMPTY_COUNT, EMPTY_OPTION_VALUE, LIMIT_OPTIONS } from '#/lib/constants.ts';
import type { RecordsRouteSearch } from '#/lib/records-search.ts';

type RecordsFiltersProps = {
  search: RecordsRouteSearch;
  sources: Source[];
  isFetching: boolean;
  onChange: (next: Partial<RecordsRouteSearch>) => void;
};

export function RecordsFilters({ search, sources, isFetching, onChange }: RecordsFiltersProps) {
  const [draft, setDraft] = useState(search.q ?? '');

  useEffect(() => {
    setDraft(search.q ?? '');
  }, [search.q]);

  const activeFilterCount = [
    search.q,
    search.dataSourceId,
    search.personId,
    search.createdAfter,
    search.createdBefore,
  ].filter(Boolean).length;

  return (
    <form
      className="grid gap-3 border-b bg-background/95 px-4 py-4 lg:grid-cols-[minmax(18rem,2fr)_repeat(5,minmax(9rem,1fr))_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ q: draft || undefined });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="record-search">Search</Label>
        <div className="flex gap-2">
          <Input
            id="record-search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search all records"
          />
          <Button type="submit" size="icon" aria-label="Search records">
            <Search />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Data Source</Label>
        <Select
          value={search.dataSourceId ?? EMPTY_OPTION_VALUE}
          onValueChange={(value) =>
            onChange({
              dataSourceId: value === EMPTY_OPTION_VALUE ? undefined : value,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_OPTION_VALUE}>All sources</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.data_source_id} value={source.data_source_id}>
                {source.data_source_key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ParticipantFilter
        personId={search.personId}
        onSelect={(personId) => onChange({ personId })}
      />

      <div className="grid gap-2">
        <Label htmlFor="created-after">From</Label>
        <Input
          id="created-after"
          type="date"
          value={search.createdAfter ?? ''}
          onChange={(event) => onChange({ createdAfter: event.target.value || undefined })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="created-before">To</Label>
        <Input
          id="created-before"
          type="date"
          value={search.createdBefore ?? ''}
          onChange={(event) => onChange({ createdBefore: event.target.value || undefined })}
        />
      </div>

      <div className="grid gap-2">
        <Label>Load Size</Label>
        <Select
          value={String(search.limit || DEFAULT_LIMIT)}
          onValueChange={(value) => onChange({ limit: Number(value) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((limit) => (
              <SelectItem key={limit} value={String(limit)}>
                {limit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={activeFilterCount > EMPTY_COUNT ? 'default' : 'secondary'}>
          {activeFilterCount} active
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Clear filters"
          disabled={activeFilterCount === EMPTY_COUNT || isFetching}
          onClick={() =>
            onChange({
              q: undefined,
              dataSourceId: undefined,
              personId: undefined,
              createdAfter: undefined,
              createdBefore: undefined,
            })
          }
        >
          <X />
        </Button>
      </div>
    </form>
  );
}
