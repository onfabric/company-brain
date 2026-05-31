import { createSync } from 'nango';
import { z } from 'zod';

import { CirclebackMcpClient } from '../mcp/client.js';

const DEFAULT_LOOKBACK_DAYS = 30;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * MILLISECONDS_PER_SECOND;
// ReadMeetings and GetTranscriptsForMeetings accept several meetings per call, so
// meetings are hydrated and saved in bounded chunks to keep memory low and make
// partial progress durable across checkpoints.
const MEETING_CHUNK_SIZE = 20;

const CirclebackAttendeeSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
});

const CirclebackTranscriptSegmentSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  offset_seconds: z.number().optional(),
});

const CirclebackMeetingSchema = z.object({
  id: z.string(),
  body: z.string(),
  title: z.string(),
  url: z.string().optional(),
  created_at: z.string(),
  duration_seconds: z.number().optional(),
  attendees: z.array(CirclebackAttendeeSchema).optional(),
  tags: z.array(z.string()).optional(),
  transcript: z.array(CirclebackTranscriptSegmentSchema),
});

const MetadataSchema = z.object({
  query: z.string().optional().describe('Optional keyword passed to Circleback SearchMeetings'),
  lookbackDays: z
    .number()
    .optional()
    .describe('How many days back to search on the first run before a checkpoint exists'),
  maxMeetings: z.number().optional().describe('Optional cap on meetings processed per execution'),
});

const CheckpointSchema = z.object({
  lastSyncDate: z.string(),
});

const RawAttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  displayName: z.string().optional(),
});

const RawTranscriptSegmentSchema = z.object({
  speaker: z.string().optional(),
  speakerName: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  content: z.string().optional(),
  start: z.number().optional(),
  startTime: z.number().optional(),
  offset: z.number().optional(),
});

const RawMeetingSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  title: z.string().optional(),
  createdAt: z.string().optional(),
  duration: z.number().optional(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attendees: z.array(RawAttendeeSchema).optional(),
  notes: z.string().optional(),
  summary: z.string().optional(),
  transcript: z.array(RawTranscriptSegmentSchema).optional(),
});

const RawMeetingListSchema = z
  .union([
    z.array(RawMeetingSchema),
    z.object({
      meetings: z.array(RawMeetingSchema).optional(),
      results: z.array(RawMeetingSchema).optional(),
      nextCursor: z.string().optional(),
      cursor: z.string().optional(),
    }),
  ])
  .transform((value) => {
    if (Array.isArray(value)) {
      return { meetings: value, nextCursor: undefined as string | undefined };
    }
    return {
      meetings: value.meetings ?? value.results ?? [],
      nextCursor: value.nextCursor ?? value.cursor,
    };
  });

const TranscriptEntrySchema = z.object({
  meetingId: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  transcript: z.array(RawTranscriptSegmentSchema).optional(),
  segments: z.array(RawTranscriptSegmentSchema).optional(),
});

const TranscriptEntryListSchema = z.array(TranscriptEntrySchema);
const TranscriptWrappedSchema = z.object({ transcripts: TranscriptEntryListSchema });
const TranscriptMapSchema = z.record(z.string(), z.array(RawTranscriptSegmentSchema));

type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

type CirclebackAttendee = z.infer<typeof CirclebackAttendeeSchema>;
type CirclebackMeeting = z.infer<typeof CirclebackMeetingSchema>;
type CirclebackTranscriptSegment = z.infer<typeof CirclebackTranscriptSegmentSchema>;
type RawAttendee = z.infer<typeof RawAttendeeSchema>;
type RawMeeting = z.infer<typeof RawMeetingSchema>;
type RawTranscriptSegment = z.infer<typeof RawTranscriptSegmentSchema>;

const sync = createSync({
  description:
    'Sync Circleback meetings as self-contained records: the call summary as the Markdown body and the full transcript with speaker labels',
  version: '1.0.0',
  endpoints: [{ method: 'POST', path: '/syncs/meetings', group: 'Meetings' }],
  frequency: 'every hour',
  autoStart: true,
  metadata: MetadataSchema,
  checkpoint: CheckpointSchema,

  models: {
    CirclebackMeeting: CirclebackMeetingSchema,
  },

  exec: async (nango) => {
    const metadata = parseOptional(MetadataSchema, await nango.getMetadata());
    const checkpoint = parseOptional(CheckpointSchema, await nango.getCheckpoint());

    const mcp = new CirclebackMcpClient(nango);
    await mcp.initialize();

    const since = resolveSince(checkpoint, metadata);
    const summaries = await searchMeetings(mcp, metadata, since);
    const newMeetings = summaries
      .filter((meeting) => isNewerThan(meeting.createdAt, since))
      .slice(0, metadata?.maxMeetings ?? summaries.length);

    let latestCreatedAt = since;

    for (const chunk of chunkBy(newMeetings, MEETING_CHUNK_SIZE)) {
      const ids = chunk.map((meeting) => String(meeting.id));
      const details = await readMeetings(mcp, ids);
      const transcripts = await getTranscripts(mcp, ids);

      const records = chunk.map((summary) =>
        buildMeeting(summary, details.get(String(summary.id)), transcripts.get(String(summary.id))),
      );

      if (records.length > 0) {
        await nango.batchSave(records, 'CirclebackMeeting');
      }

      for (const record of records) {
        latestCreatedAt = laterIso(latestCreatedAt, record.created_at);
      }

      await nango.saveCheckpoint({ lastSyncDate: latestCreatedAt });
    }

    await nango.saveCheckpoint({ lastSyncDate: laterIso(latestCreatedAt, since) });
  },
});

async function searchMeetings(
  mcp: CirclebackMcpClient,
  metadata: z.infer<typeof MetadataSchema> | undefined,
  since: string,
): Promise<RawMeeting[]> {
  const meetings: RawMeeting[] = [];
  let cursor: string | undefined;

  do {
    const args = withoutUndefined({
      query: metadata?.query,
      startDate: since,
      cursor,
    });
    const page = await mcp.callTool('SearchMeetings', args, RawMeetingListSchema);
    meetings.push(...page.meetings);
    cursor = page.nextCursor;
  } while (cursor);

  return meetings;
}

async function readMeetings(
  mcp: CirclebackMcpClient,
  meetingIds: string[],
): Promise<Map<string, RawMeeting>> {
  const page = await mcp.callTool('ReadMeetings', { meetingIds }, RawMeetingListSchema);
  return new Map(page.meetings.map((meeting) => [String(meeting.id), meeting]));
}

async function getTranscripts(
  mcp: CirclebackMcpClient,
  meetingIds: string[],
): Promise<Map<string, RawTranscriptSegment[]>> {
  const raw = await mcp.callTool('GetTranscriptsForMeetings', { meetingIds }, z.unknown());
  return normalizeTranscripts(raw);
}

// GetTranscriptsForMeetings is not formally documented, so accept the plausible
// shapes: an array of entries, a `{ transcripts: [...] }` wrapper, or a map keyed
// by meeting id. Each entry is reduced to its segment list.
function normalizeTranscripts(raw: unknown): Map<string, RawTranscriptSegment[]> {
  const byMeeting = new Map<string, RawTranscriptSegment[]>();

  const wrapped = TranscriptWrappedSchema.safeParse(raw);
  const list = TranscriptEntryListSchema.safeParse(raw);
  if (wrapped.success || list.success) {
    const entries: TranscriptEntry[] = wrapped.success
      ? wrapped.data.transcripts
      : list.success
        ? list.data
        : [];
    for (const entry of entries) {
      const key = entry.meetingId ?? entry.id;
      if (key !== undefined) {
        byMeeting.set(String(key), entry.transcript ?? entry.segments ?? []);
      }
    }
    return byMeeting;
  }

  const map = TranscriptMapSchema.safeParse(raw);
  if (map.success) {
    for (const [key, segments] of Object.entries(map.data)) {
      byMeeting.set(key, segments);
    }
  }

  return byMeeting;
}

function buildMeeting(
  summary: RawMeeting,
  details: RawMeeting | undefined,
  transcriptSegments: RawTranscriptSegment[] | undefined,
): CirclebackMeeting {
  const merged = { ...summary, ...withoutUndefined(details ?? {}) };
  const title = firstNonEmpty(merged.name, merged.title) ?? 'Untitled meeting';
  const createdAt = toIso(merged.createdAt);
  const attendees = mapAttendees(merged.attendees);
  const tags = uniqueStrings(merged.tags ?? []);
  const transcript = mapTranscript(transcriptSegments ?? merged.transcript ?? []);

  return CirclebackMeetingSchema.parse(
    withoutUndefined({
      id: String(merged.id),
      body: renderBody(title, createdAt, merged, attendees),
      title,
      url: merged.url,
      created_at: createdAt,
      duration_seconds: merged.duration,
      attendees: attendees.length > 0 ? attendees : undefined,
      tags: tags.length > 0 ? tags : undefined,
      transcript,
    }),
  );
}

function mapAttendees(attendees: RawAttendee[] | undefined): CirclebackAttendee[] {
  return (attendees ?? [])
    .map((attendee) =>
      withoutUndefined({
        name: firstNonEmpty(attendee.name, attendee.displayName, attendee.email) ?? 'unknown',
        email: attendee.email,
      }),
    )
    .filter((attendee) => attendee.name !== 'unknown' || attendee.email);
}

function mapTranscript(segments: RawTranscriptSegment[]): CirclebackTranscriptSegment[] {
  return segments
    .map((segment) =>
      withoutUndefined({
        speaker: firstNonEmpty(segment.speaker, segment.speakerName, segment.name) ?? 'Unknown',
        text: (segment.text ?? segment.content ?? '').trim(),
        offset_seconds: segment.start ?? segment.startTime ?? segment.offset,
      }),
    )
    .filter((segment) => segment.text.length > 0);
}

function renderBody(
  title: string,
  createdAt: string,
  meeting: RawMeeting,
  attendees: CirclebackAttendee[],
): string {
  const lines = [`# ${title}`, '', `- Date: ${createdAt}`];

  if (typeof meeting.duration === 'number') {
    lines.push(`- Duration: ${formatDuration(meeting.duration)}`);
  }

  if (attendees.length > 0) {
    lines.push(`- Attendees: ${attendees.map(renderAttendee).join(', ')}`);
  }

  if (meeting.url) {
    lines.push(`- URL: ${meeting.url}`);
  }

  const summary = firstNonEmpty(meeting.summary);
  const notes = firstNonEmpty(meeting.notes);

  if (summary) {
    lines.push('', '## Summary', '', summary);
  }

  if (notes) {
    lines.push('', '## Notes', '', notes);
  }

  if (!summary && !notes) {
    lines.push('', '## Summary', '', '(no summary)');
  }

  return lines.join('\n').trim();
}

function renderAttendee(attendee: CirclebackAttendee): string {
  return attendee.email ? `${attendee.name} <${attendee.email}>` : attendee.name;
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

function resolveSince(
  checkpoint: z.infer<typeof CheckpointSchema> | undefined,
  metadata: z.infer<typeof MetadataSchema> | undefined,
): string {
  if (checkpoint?.lastSyncDate) {
    return checkpoint.lastSyncDate;
  }

  const lookbackDays = metadata?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  return new Date(Date.now() - lookbackDays * MILLISECONDS_PER_DAY).toISOString();
}

function chunkBy<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isNewerThan(timestamp: string | undefined, since: string): boolean {
  if (!timestamp) {
    return true;
  }

  return Date.parse(timestamp) > Date.parse(since);
}

function laterIso(current: string, candidate: string): string {
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

function toIso(value: string | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

function uniqueStrings(values: string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ].sort();
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0);
}

function parseOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

export type NangoSyncLocal = Parameters<(typeof sync)['exec']>[0];
export default sync;
