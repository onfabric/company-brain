import { createSync } from 'nango';
import { z } from 'zod';

import { BatchWriter } from '../../syncs/batch-writer.js';
import { createBrainSink } from '../../syncs/brain-sink.js';
import {
  type GmailAttachment,
  type GmailMessage,
  type GmailThread,
  GmailThreadSchema,
} from './model.js';
import { renderThreadBody } from './render.js';

const MAX_GMAIL_PAGE_SIZE = 500;
const THREADS_PAGE_SIZE = 100;
const HISTORY_PAGE_SIZE = MAX_GMAIL_PAGE_SIZE;
const PROXY_RETRIES = 3;
const NOT_FOUND_STATUS = 404;
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const NO_SUBJECT = '(no subject)';

const MetadataSchema = z.object({
  includeSpamTrash: z
    .boolean()
    .optional()
    .describe('Whether to include Gmail Spam and Trash in the full mailbox backfill'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_GMAIL_PAGE_SIZE)
    .optional()
    .describe('Threads to hydrate per Gmail list page during backfill'),
});

const CheckpointSchema = z.object({
  phase: z.string(),
  history_id: z.string(),
  page_token: z.string(),
  backfill_history_id: z.string(),
});

const LegacyCheckpointSchema = z.object({
  phase: z.string().optional(),
  history_id: z.string().optional(),
  page_token: z.string().optional(),
  backfill_history_id: z.string().optional(),
});

const ProfileSchema = z.object({
  emailAddress: z.string().optional(),
  historyId: z.string(),
});

const LabelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const LabelListResponseSchema = z.object({
  labels: z.array(LabelSchema).optional(),
});

const ThreadListItemSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  snippet: z.string().optional(),
});

const ThreadListResponseSchema = z.object({
  threads: z.array(ThreadListItemSchema).optional(),
  nextPageToken: z.string().optional(),
});

const HistoryMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
  historyId: z.string().optional(),
});

const HistoryMessageAddedSchema = z.object({
  message: HistoryMessageSchema,
});

const HistoryMessageDeletedSchema = z.object({
  message: HistoryMessageSchema,
});

const HistoryLabelChangeSchema = z.object({
  message: HistoryMessageSchema,
  labelIds: z.array(z.string()),
});

const HistorySchema = z.object({
  id: z.string(),
  messages: z.array(HistoryMessageSchema).optional(),
  messagesAdded: z.array(HistoryMessageAddedSchema).optional(),
  messagesDeleted: z.array(HistoryMessageDeletedSchema).optional(),
  labelsAdded: z.array(HistoryLabelChangeSchema).optional(),
  labelsRemoved: z.array(HistoryLabelChangeSchema).optional(),
});

const HistoryListResponseSchema = z.object({
  history: z.array(HistorySchema).optional(),
  nextPageToken: z.string().optional(),
  historyId: z.string().optional(),
});

type RawHeader = {
  name: string;
  value: string;
};

type RawMessagePartBody = {
  attachmentId?: string | undefined;
  size?: number | undefined;
  data?: string | undefined;
};

type RawMessagePart = {
  partId?: string | undefined;
  mimeType?: string | undefined;
  filename?: string | undefined;
  headers?: RawHeader[] | undefined;
  body?: RawMessagePartBody | undefined;
  parts?: RawMessagePart[] | undefined;
};

const RawHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const RawMessagePartBodySchema = z.object({
  attachmentId: z.string().optional(),
  size: z.number().optional(),
  data: z.string().optional(),
});

const RawMessagePartSchema: z.ZodType<RawMessagePart> = z.lazy(() =>
  z.object({
    partId: z.string().optional(),
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    headers: z.array(RawHeaderSchema).optional(),
    body: RawMessagePartBodySchema.optional(),
    parts: z.array(RawMessagePartSchema).optional(),
  }),
);

const RawMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string(),
  payload: RawMessagePartSchema.optional(),
  sizeEstimate: z.number().optional(),
});

const RawThreadSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  messages: z.array(RawMessageSchema).optional(),
});

type Metadata = z.infer<typeof MetadataSchema>;
type LegacyCheckpoint = z.infer<typeof LegacyCheckpointSchema>;
type Profile = z.infer<typeof ProfileSchema>;
type RawMessage = z.infer<typeof RawMessageSchema>;
type RawThread = z.infer<typeof RawThreadSchema>;
type GetResponse = Awaited<ReturnType<NangoSyncLocal['get']>>;
type NormalizedCheckpoint = {
  phase: 'backfill' | 'history';
  history_id: string | undefined;
  page_token: string | undefined;
  backfill_history_id: string | undefined;
};

type SyncContext = {
  profile: Profile;
  labelsById: Map<string, string>;
};

type Address = {
  raw: string;
  identifier: string;
};

const EMPTY_BACKFILL_CHECKPOINT: NormalizedCheckpoint = {
  phase: 'backfill',
  history_id: undefined,
  page_token: undefined,
  backfill_history_id: undefined,
};

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  apos: "'",
};

const sync = createSync({
  description:
    'Sync Gmail conversation threads as self-contained records with participants, labels, message bodies, and attachment metadata',
  version: '1.0.1',
  endpoints: [{ method: 'POST', path: '/syncs/gmail-threads', group: 'Gmail Threads' }],
  frequency: 'every 5 minutes',
  autoStart: true,
  scopes: [GMAIL_READONLY_SCOPE],
  metadata: MetadataSchema,
  checkpoint: CheckpointSchema,

  models: {
    GmailThread: GmailThreadSchema,
  },

  exec: async (nango) => {
    const metadata = parseOptional(MetadataSchema, await nango.getMetadata()) ?? {};
    const checkpoint = normalizeCheckpoint(parseCheckpoint(await nango.getCheckpoint()));
    const context = {
      profile: await fetchProfile(nango),
      labelsById: await fetchLabelsById(nango),
    };

    if (checkpoint.phase === 'history' && checkpoint.history_id) {
      await syncHistory(nango, checkpoint, context, metadata);
      return;
    }

    await syncBackfill(nango, checkpoint, context, metadata);
  },
});

function parseOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseCheckpoint(checkpoint: unknown): LegacyCheckpoint | null {
  const parsed = LegacyCheckpointSchema.safeParse(checkpoint);
  return parsed.success ? parsed.data : null;
}

function normalizeCheckpoint(checkpoint: LegacyCheckpoint | null): NormalizedCheckpoint {
  if (!checkpoint) {
    return EMPTY_BACKFILL_CHECKPOINT;
  }

  if (checkpoint.phase === 'history' && checkpoint.history_id) {
    return {
      phase: 'history',
      history_id: checkpoint.history_id,
      page_token: checkpoint.page_token,
      backfill_history_id: undefined,
    };
  }

  if (checkpoint.phase === 'backfill') {
    return {
      phase: 'backfill',
      history_id: undefined,
      page_token: checkpoint.page_token,
      backfill_history_id: checkpoint.backfill_history_id,
    };
  }

  if (checkpoint.page_token) {
    return EMPTY_BACKFILL_CHECKPOINT;
  }

  if (checkpoint.history_id) {
    return {
      phase: 'history',
      history_id: checkpoint.history_id,
      page_token: undefined,
      backfill_history_id: undefined,
    };
  }

  return EMPTY_BACKFILL_CHECKPOINT;
}

async function syncBackfill(
  nango: NangoSyncLocal,
  checkpoint: NormalizedCheckpoint,
  context: SyncContext,
  metadata: Metadata,
): Promise<void> {
  let pageToken = checkpoint.phase === 'backfill' ? checkpoint.page_token : undefined;
  const pageSize = metadata.pageSize ?? THREADS_PAGE_SIZE;
  const includeSpamTrash = metadata.includeSpamTrash ?? true;
  const backfillHistoryId =
    checkpoint.phase === 'backfill' && checkpoint.backfill_history_id
      ? checkpoint.backfill_history_id
      : context.profile.historyId;

  if (!pageToken) {
    await nango.trackDeletesStart('GmailThread');
  }

  while (true) {
    pageToken = await syncBackfillPage(nango, context, {
      pageSize,
      includeSpamTrash,
      pageToken,
    });

    if (!pageToken) {
      break;
    }

    await nango.saveCheckpoint({
      phase: 'backfill',
      history_id: '',
      page_token: pageToken,
      backfill_history_id: backfillHistoryId,
    });
  }

  await nango.trackDeletesEnd('GmailThread');
  await nango.saveCheckpoint({
    phase: 'history',
    history_id: backfillHistoryId,
    page_token: '',
    backfill_history_id: '',
  });
}

async function syncBackfillPage(
  nango: NangoSyncLocal,
  context: SyncContext,
  options: {
    pageSize: number;
    includeSpamTrash: boolean;
    pageToken: string | undefined;
  },
): Promise<string | undefined> {
  const listResponse = await nango.get({
    endpoint: '/gmail/v1/users/me/threads',
    params: {
      maxResults: options.pageSize,
      includeSpamTrash: options.includeSpamTrash ? 'true' : 'false',
      ...(options.pageToken && { pageToken: options.pageToken }),
    },
    retries: PROXY_RETRIES,
  });
  const listData = ThreadListResponseSchema.parse(listResponse.data);
  const writer = createThreadWriter(nango, options.pageSize);

  for (const threadSummary of listData.threads ?? []) {
    const thread = await fetchThread(nango, threadSummary.id, context);
    if (thread) {
      await writer.save(thread);
    }
  }

  await writer.flush();
  return listData.nextPageToken;
}

async function syncHistory(
  nango: NangoSyncLocal,
  checkpoint: NormalizedCheckpoint,
  context: SyncContext,
  metadata: Metadata,
): Promise<void> {
  const startHistoryId = checkpoint.history_id;
  if (!startHistoryId) {
    await syncBackfill(nango, EMPTY_BACKFILL_CHECKPOINT, context, metadata);
    return;
  }

  let response: GetResponse;
  try {
    response = await nango.get({
      endpoint: '/gmail/v1/users/me/history',
      params: {
        startHistoryId,
        maxResults: HISTORY_PAGE_SIZE,
        ...(checkpoint.page_token && { pageToken: checkpoint.page_token }),
      },
      retries: PROXY_RETRIES,
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      await syncBackfill(nango, EMPTY_BACKFILL_CHECKPOINT, context, metadata);
      return;
    }

    throw error;
  }

  const historyData = HistoryListResponseSchema.parse(response.data);
  const threadIdsToRefresh = getChangedThreadIds(historyData.history ?? []);
  const threadIdsToDelete = new Set<string>();
  const writer = createThreadWriter(nango, THREADS_PAGE_SIZE);

  for (const threadId of threadIdsToRefresh) {
    const thread = await fetchThread(nango, threadId, context);
    if (thread) {
      await writer.save(thread);
      continue;
    }

    threadIdsToDelete.add(threadId);
  }

  await writer.flush();

  if (threadIdsToDelete.size > 0) {
    await nango.batchDelete(
      Array.from(threadIdsToDelete).map((id) => ({ id })),
      'GmailThread',
    );
  }

  if (historyData.nextPageToken) {
    await nango.saveCheckpoint({
      phase: 'history',
      history_id: startHistoryId,
      page_token: historyData.nextPageToken,
      backfill_history_id: '',
    });
    return;
  }

  await nango.saveCheckpoint({
    phase: 'history',
    history_id: historyData.historyId ?? startHistoryId,
    page_token: '',
    backfill_history_id: '',
  });
}

function createThreadWriter(nango: NangoSyncLocal, batchSize: number): BatchWriter<GmailThread> {
  return new BatchWriter<GmailThread>({
    nango,
    model: 'GmailThread',
    batchSize,
    schema: GmailThreadSchema,
    afterSave: createBrainSink(nango),
  });
}

async function fetchProfile(nango: NangoSyncLocal): Promise<Profile> {
  const response = await nango.get({
    endpoint: '/gmail/v1/users/me/profile',
    retries: PROXY_RETRIES,
  });
  return ProfileSchema.parse(response.data);
}

async function fetchLabelsById(nango: NangoSyncLocal): Promise<Map<string, string>> {
  const response = await nango.get({
    endpoint: '/gmail/v1/users/me/labels',
    retries: PROXY_RETRIES,
  });
  const labels = LabelListResponseSchema.parse(response.data).labels ?? [];

  return new Map(labels.map((label) => [label.id, label.name?.trim() || label.id]));
}

async function fetchThread(
  nango: NangoSyncLocal,
  threadId: string,
  context: SyncContext,
): Promise<GmailThread | null> {
  let response: GetResponse;
  try {
    response = await nango.get({
      endpoint: `/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}`,
      params: {
        format: 'full',
      },
      retries: PROXY_RETRIES,
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }

  return mapThread(RawThreadSchema.parse(response.data), context);
}

function getChangedThreadIds(historyRecords: z.infer<typeof HistorySchema>[]): Set<string> {
  const threadIds = new Set<string>();
  for (const history of historyRecords) {
    for (const message of history.messages ?? []) {
      threadIds.add(message.threadId);
    }
    for (const added of history.messagesAdded ?? []) {
      threadIds.add(added.message.threadId);
    }
    for (const deleted of history.messagesDeleted ?? []) {
      threadIds.add(deleted.message.threadId);
    }
    for (const labelChange of history.labelsAdded ?? []) {
      threadIds.add(labelChange.message.threadId);
    }
    for (const labelChange of history.labelsRemoved ?? []) {
      threadIds.add(labelChange.message.threadId);
    }
  }

  return threadIds;
}

function mapThread(rawThread: RawThread, context: SyncContext): GmailThread | null {
  const rawMessages = [...(rawThread.messages ?? [])].sort(
    (left, right) => Number(left.internalDate) - Number(right.internalDate),
  );
  if (rawMessages.length === 0) {
    return null;
  }

  const messages = rawMessages.map((rawMessage) => mapMessage(rawMessage, context.labelsById));
  const createdAt = messages[0]?.sent_at;
  const updatedAt = messages.at(-1)?.sent_at;
  if (!createdAt || !updatedAt) {
    return null;
  }

  const labels = uniqueSorted(messages.flatMap((message) => message.labels ?? []));
  const subject = firstNonEmpty(messages.map((message) => message.subject)) ?? NO_SUBJECT;
  const partialThread = {
    id: rawThread.id,
    mailbox: context.profile.emailAddress,
    subject,
    labels: labels.length > 0 ? labels : undefined,
    created_at: createdAt,
    updated_at: updatedAt,
    participants: collectParticipants(messages),
    messages,
  };

  return {
    ...partialThread,
    body: renderThreadBody(partialThread),
  };
}

function mapMessage(rawMessage: RawMessage, labelsById: Map<string, string>): GmailMessage {
  const headers = headersByLowerName(rawMessage.payload?.headers ?? []);
  const labels = mapLabels(rawMessage.labelIds ?? [], labelsById);
  const attachments = collectAttachments(rawMessage.payload);

  return withoutUndefined({
    sent_at: millisecondsToIso(rawMessage.internalDate),
    from: firstAddressIdentifier(headers.get('from')),
    to: addressIdentifiers(headers.get('to')),
    cc: addressIdentifiers(headers.get('cc')),
    bcc: addressIdentifiers(headers.get('bcc')),
    subject: nonEmpty(headers.get('subject')),
    labels: labels.length > 0 ? labels : undefined,
    text: extractMessageText(rawMessage.payload, rawMessage.snippet),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

function headersByLowerName(headers: RawHeader[]): Map<string, string> {
  const byName = new Map<string, string>();
  for (const header of headers) {
    byName.set(header.name.toLowerCase(), header.value);
  }
  return byName;
}

function mapLabels(labelIds: string[], labelsById: Map<string, string>): string[] {
  return uniqueSorted(labelIds.map((labelId) => labelsById.get(labelId) ?? labelId));
}

function collectParticipants(messages: GmailMessage[]): string[] {
  return uniqueSorted(
    messages.flatMap((message) => [
      message.from,
      ...(message.to ?? []),
      ...(message.cc ?? []),
      ...(message.bcc ?? []),
    ]),
  );
}

function collectAttachments(part: RawMessagePart | undefined): GmailAttachment[] {
  if (!part) {
    return [];
  }

  const filename = nonEmpty(part.filename);
  const attachment = filename
    ? [
        withoutUndefined({
          filename,
          mime_type: nonEmpty(part.mimeType),
          size: part.body?.size,
        }),
      ]
    : [];

  return [...attachment, ...(part.parts ?? []).flatMap(collectAttachments)];
}

function extractMessageText(part: RawMessagePart | undefined, snippet: string | undefined): string {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];
  collectTextParts(part, plainParts, htmlParts);

  return (
    normalizeText(plainParts.join('\n\n')) ||
    normalizeText(stripHtml(htmlParts.join('\n\n'))) ||
    normalizeText(snippet ?? '') ||
    ''
  );
}

function collectTextParts(
  part: RawMessagePart | undefined,
  plainParts: string[],
  htmlParts: string[],
): void {
  if (!part) {
    return;
  }

  const mimeType = part.mimeType?.toLowerCase();
  const data = part.body?.data;
  if (data && mimeType === 'text/plain') {
    plainParts.push(decodeBase64Url(data));
  } else if (data && mimeType === 'text/html') {
    htmlParts.push(decodeBase64Url(data));
  }

  for (const child of part.parts ?? []) {
    collectTextParts(child, plainParts, htmlParts);
  }
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|li|tr|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ''),
  );
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return HTML_ENTITIES[name.toLowerCase()] ?? entity;
  });
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8');
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstAddressIdentifier(headerValue: string | undefined): string | undefined {
  return parseAddressList(headerValue)[0]?.identifier;
}

function addressIdentifiers(headerValue: string | undefined): string[] | undefined {
  const identifiers = uniqueSorted(
    parseAddressList(headerValue).map((address) => address.identifier),
  );
  return identifiers.length > 0 ? identifiers : undefined;
}

function parseAddressList(headerValue: string | undefined): Address[] {
  if (!headerValue) {
    return [];
  }

  return splitAddressHeader(headerValue)
    .map(parseAddress)
    .filter((address): address is Address => Boolean(address));
}

function splitAddressHeader(value: string): string[] {
  const addresses: string[] = [];
  let current = '';
  let insideQuotes = false;
  let angleDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];
    if (character === '"' && previous !== '\\') {
      insideQuotes = !insideQuotes;
    } else if (!insideQuotes && character === '<') {
      angleDepth += 1;
    } else if (!insideQuotes && character === '>' && angleDepth > 0) {
      angleDepth -= 1;
    }

    if (character === ',' && !insideQuotes && angleDepth === 0) {
      addresses.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  addresses.push(current);
  return addresses.map((address) => address.trim()).filter(Boolean);
}

function parseAddress(rawAddress: string): Address | undefined {
  const raw = rawAddress.trim();
  const angleMatch = raw.match(/<([^>]+)>/);
  const email = angleMatch?.[1] ?? raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const fallback = raw.replace(/^"|"$/g, '').trim();
  const identifier = nonEmpty(email)?.toLowerCase() ?? nonEmpty(fallback);

  return identifier ? { raw, identifier } : undefined;
}

function millisecondsToIso(value: string): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid Gmail internalDate: ${value}`);
  }

  return new Date(timestamp).toISOString();
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const status = 'status' in error ? error.status : undefined;
  if (status === NOT_FOUND_STATUS) {
    return true;
  }

  const payload = 'payload' in error ? error.payload : undefined;
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const nestedError = 'error' in payload ? payload.error : undefined;
  if (!nestedError || typeof nestedError !== 'object') {
    return false;
  }

  return 'code' in nestedError && nestedError.code === NOT_FOUND_STATUS;
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function firstNonEmpty(values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()))?.trim();
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

export type NangoSyncLocal = Parameters<typeof sync.exec>[0];
export default sync;
