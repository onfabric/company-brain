import type { z } from 'zod';

import type {
  NotionFile,
  NotionLink,
  NotionPerson,
  NotionProperty,
  NotionReference,
  SyncMetadata,
} from './models.js';

const NOTION_VERSION = '2026-03-11';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_BLOCK_DEPTH = 12;

export function parseOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function compactJoin(values: Array<string | undefined>, separator: string): string {
  return values.filter(isString).join(separator).trim();
}

export function indentMarkdown(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
}

export function quoteMarkdown(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

export function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => (part ? `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}` : part))
    .join(' ');
}

export function pageSize(metadata: SyncMetadata | undefined): number {
  return positiveNumber(metadata?.pageSize) ?? DEFAULT_PAGE_SIZE;
}

export function batchSize(metadata: SyncMetadata | undefined): number {
  return positiveNumber(metadata?.batchSize) ?? DEFAULT_BATCH_SIZE;
}

export function maxBlockDepth(metadata: SyncMetadata | undefined): number {
  return positiveNumber(metadata?.maxBlockDepth) ?? DEFAULT_MAX_BLOCK_DEPTH;
}

export function notionHeaders(): Record<string, string> {
  return {
    'notion-version': NOTION_VERSION,
  };
}

export function notionPaginationParams(
  metadata: SyncMetadata | undefined,
  cursor: string | undefined,
): Record<string, string | number> {
  return cursor
    ? { page_size: pageSize(metadata), start_cursor: cursor }
    : { page_size: pageSize(metadata) };
}

export function notionUrlFromId(id: string): string {
  return `https://www.notion.so/${id.replace(/-/g, '')}`;
}

export function firstNonExpiringUrl(...urls: Array<string | undefined>): string | undefined {
  return urls.find((url) => url && !isExpiringUrl(url));
}

export function isExpiringUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.includes('secure.notion-static.com') ||
    lowerUrl.includes('x-amz-expires=') ||
    lowerUrl.includes('x-amz-signature=') ||
    lowerUrl.includes('x-amz-credential=')
  );
}

export function uniqueRefs(refs: NotionReference[]): NotionReference[] {
  return uniqueBy(refs, (ref) => `${ref.title}\n${ref.url ?? ''}`);
}

export function uniqueFiles(files: NotionFile[]): NotionFile[] {
  return uniqueBy(
    files,
    (file) => `${file.kind}\n${file.name ?? ''}\n${file.url ?? ''}\n${file.caption ?? ''}`,
  );
}

export function uniqueLinks(links: NotionLink[]): NotionLink[] {
  return uniqueBy(
    links.filter((link) => !isExpiringUrl(link.url)),
    (link) => link.url,
  );
}

export function uniquePeople(people: NotionPerson[]): NotionPerson[] {
  return uniqueBy(people, (person) => person.identifier);
}

export function uniqueProperties(properties: NotionProperty[]): NotionProperty[] {
  return uniqueBy(properties, (property) => property.name);
}

export function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    const key = keyFor(item);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

export function renderDateRange(
  date: { start?: string; end?: string | null } | null | undefined,
): string {
  if (!date?.start) {
    return '';
  }

  return date.end ? `${date.start} - ${date.end}` : date.start;
}

function positiveNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && value > 0 ? value : undefined;
}
