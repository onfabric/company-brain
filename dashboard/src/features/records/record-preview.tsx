import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Badge } from '#/components/ui/badge.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';
import { ScrollArea } from '#/components/ui/scroll-area.tsx';
import { Separator } from '#/components/ui/separator.tsx';
import { formatDateTime, participantLabel, recordTitle } from '#/features/records/record-format.ts';
import type { RecordHit } from '#/lib/brain-functions.ts';

type RecordPreviewProps = {
  record: RecordHit | null;
};

export function RecordPreview({ record }: RecordPreviewProps) {
  if (!record) {
    return (
      <Card className="h-full min-h-[32rem]">
        <CardHeader>
          <CardTitle>Record</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">No record selected.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-[32rem] overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{record.data_source_key}</Badge>
          <span className="text-muted-foreground text-xs">{formatDateTime(record.created_at)}</span>
        </div>
        <CardTitle className="leading-snug">{recordTitle(record)}</CardTitle>
        <div className="flex flex-wrap gap-1">
          {record.participants.map((participant) => (
            <Badge key={participant.id} variant="secondary">
              {participantLabel(participant)}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-17rem)] min-h-[24rem] px-5 py-4">
          <div className="prose prose-neutral max-w-none prose-headings:scroll-m-20 prose-pre:whitespace-pre-wrap prose-a:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {record.body}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
