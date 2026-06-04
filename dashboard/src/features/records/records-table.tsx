import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FileText } from 'lucide-react';
import { Fragment } from 'react';
import { Badge } from '#/components/ui/badge.tsx';
import { Button } from '#/components/ui/button.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx';
import {
  formatDateTime,
  participantLabel,
  recordDayLabel,
  recordPreview,
  recordTitle,
} from '#/features/records/record-format.ts';
import type { RecordHit } from '#/lib/brain-functions.ts';
import { EMPTY_COUNT, SCORE_PRECISION } from '#/lib/constants.ts';
import { dayKey } from '#/lib/records-search.ts';

type RecordsTableProps = {
  records: RecordHit[];
  selectedRecordId: string | undefined;
  onSelectRecord: (id: string) => void;
};

const columns: Array<ColumnDef<RecordHit>> = [
  {
    accessorKey: 'data_source_key',
    header: 'Source',
    cell: ({ row }) => <Badge variant="outline">{row.original.data_source_key}</Badge>,
  },
  {
    id: 'record',
    header: 'Record',
    cell: ({ row }) => (
      <div className="grid max-w-[44rem] gap-1">
        <div className="font-medium text-foreground">{recordTitle(row.original)}</div>
        <div className="line-clamp-2 text-muted-foreground text-xs">
          {recordPreview(row.original)}
        </div>
      </div>
    ),
  },
  {
    id: 'participants',
    header: 'Participants',
    cell: ({ row }) => (
      <div className="flex max-w-56 flex-wrap gap-1">
        {row.original.participants.length > EMPTY_COUNT ? (
          row.original.participants.map((participant) => (
            <Badge key={participant.id} variant="secondary">
              {participantLabel(participant)}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">None</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {formatDateTime(row.original.created_at)}
      </span>
    ),
  },
  {
    accessorKey: 'score',
    header: 'Score',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.score === null ? '—' : row.original.score.toFixed(SCORE_PRECISION)}
      </span>
    ),
  },
];

const columnClassNames: Record<string, string> = {
  data_source_key: 'w-36',
  record: 'w-[34rem]',
  participants: 'w-56',
  created_at: 'w-44',
  score: 'w-24',
};

export function RecordsTable({ records, selectedRecordId, onSelectRecord }: RecordsTableProps) {
  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  let previousDay: string | undefined;

  return (
    <Table className="min-w-[76rem] table-fixed">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={columnClassNames[header.column.id]}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const currentDay = dayKey(row.original.created_at);
          const showDay = currentDay !== previousDay;
          previousDay = currentDay;

          return (
            <Fragment key={row.id}>
              {showDay ? (
                <TableRow key={`${currentDay}-header`} className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="bg-muted/50 font-medium text-xs">
                    {recordDayLabel(row.original)}
                  </TableCell>
                </TableRow>
              ) : null}
              <TableRow
                key={row.id}
                data-state={row.original.id === selectedRecordId ? 'selected' : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={columnClassNames[cell.column.id]}>
                    {cell.column.id === 'record' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto justify-start p-0 text-left font-normal hover:bg-transparent"
                        onClick={() => onSelectRecord(row.original.id)}
                      >
                        <FileText />
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Button>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
