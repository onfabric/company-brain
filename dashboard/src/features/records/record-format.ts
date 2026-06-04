import type { RecordHit } from '#/lib/brain-functions.ts';
import { DATE_TIME_FORMAT_OPTIONS, EMPTY_COUNT, RECORD_PREVIEW_LINES } from '#/lib/constants.ts';
import { dayKey } from '#/lib/records-search.ts';

const headingPattern = /^#\s+/;
const markdownPrefixPattern = /^[-*`>\s#]+/;
const whitespacePattern = /\s+/g;

export function recordTitle(record: Pick<RecordHit, 'body' | 'id'>) {
  const heading = record.body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => headingPattern.test(line));

  return heading?.replace(headingPattern, '').trim() || record.id;
}

export function recordPreview(record: Pick<RecordHit, 'body'>) {
  return record.body
    .split('\n')
    .map((line) => line.replace(markdownPrefixPattern, '').trim())
    .filter(Boolean)
    .slice(0, RECORD_PREVIEW_LINES)
    .join(' ')
    .replace(whitespacePattern, ' ');
}

export function recordDayLabel(record: Pick<RecordHit, 'created_at'>) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(
    new Date(dayKey(record.created_at)),
  );
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, DATE_TIME_FORMAT_OPTIONS).format(new Date(value));
}

export function participantLabel(participant: {
  name: string | null;
  email: string | null;
  id: string;
  data_sources?: Array<{ data_source_user_id: string }>;
}) {
  return (
    participant.name ??
    participant.email ??
    participant.data_sources?.[EMPTY_COUNT]?.data_source_user_id ??
    participant.id
  );
}
