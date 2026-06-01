import { createSync } from 'nango';
import { z } from 'zod';
import { BatchWriter } from '../../syncs/batch-writer.js';
import { defineCompanyBrainRecord } from '../../syncs/company-brain-record.js';
import { CirclebackMcpClient } from '../mcp/client.js';

const DEFAULT_LOOKBACK_DAYS = 30;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * MILLISECONDS_PER_SECOND;
// ReadMeetings and GetTranscriptsForMeetings accept several meetings per call, so
// meetings are hydrated and saved in bounded chunks to keep memory low and make
// partial progress durable across checkpoints.
const MEETING_CHUNK_SIZE = 20;
// Safety bound on SearchMeetings paging, which returns a plain array with no
// cursor or total; paging stops earlier once a page comes back empty.
const MAX_SEARCH_PAGES = 100;
// Every Circleback MCP tool requires an `intent` describing why it is called.
const SYNC_INTENT = 'Sync meetings into Company Brain for search and retrieval';

const CirclebackAttendeeSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
});

const CirclebackTranscriptSegmentSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  offset_seconds: z.number().optional(),
});

const CirclebackMeetingSchema = defineCompanyBrainRecord({
  title: z.string(),
  url: z.string().optional(),
  created_at: z.string(),
  duration_seconds: z.number().optional(),
  attendees: z.array(CirclebackAttendeeSchema).optional(),
  tags: z.array(z.string()).optional(),
  transcript: z.array(CirclebackTranscriptSegmentSchema),
});

const MetadataSchema = z.object({
  query: z.string().optional().describe('Optional searchTerm passed to Circleback SearchMeetings'),
  lookbackDays: z
    .number()
    .optional()
    .describe('How many days back to search on the first run before a checkpoint exists'),
  maxMeetings: z.number().optional().describe('Optional cap on meetings processed per execution'),
});

const CheckpointSchema = z.object({
  lastSyncDate: z.string(),
});

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

const RawAttendeeSchema = z.object({
  name: nullableString,
  email: nullableString,
});

const RawTranscriptSegmentSchema = z.object({
  speaker: nullableString,
  text: nullableString,
  timestamp: nullableNumber,
});

const RawMeetingSchema = z.object({
  id: z.union([z.string(), z.number()]),
  linkId: nullableString,
  name: nullableString,
  createdAt: nullableString,
  duration: nullableNumber,
  url: nullableString,
  tags: z.array(z.string()).nullable().optional(),
  attendees: z.array(RawAttendeeSchema).nullable().optional(),
  notes: nullableString,
});

const RawMeetingListSchema = z.array(RawMeetingSchema);

const TranscriptEntrySchema = z.object({
  meetingId: z.union([z.string(), z.number()]).nullable().optional(),
  transcript: z.array(RawTranscriptSegmentSchema).nullable().optional(),
});

const TranscriptEntryListSchema = z.array(TranscriptEntrySchema);

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

    const writer = new BatchWriter<CirclebackMeeting>({
      nango,
      model: 'CirclebackMeeting',
      batchSize: MEETING_CHUNK_SIZE,
      schema: CirclebackMeetingSchema,
    });
    const since = resolveSince(checkpoint, metadata);
    const summaries = await searchMeetings(mcp, metadata, since);
    // Oldest first so the per-chunk checkpoint only ever advances past meetings
    // that were fully saved; if a later chunk is rate-limited and the run fails,
    // the unsaved meetings are all newer than the checkpoint and the next run
    // re-fetches them instead of skipping them.
    const newMeetings = summaries
      .filter((meeting) => isNewerThan(meeting.createdAt, since))
      .sort((a, b) => Date.parse(toIso(a.createdAt)) - Date.parse(toIso(b.createdAt)))
      .slice(0, metadata?.maxMeetings ?? summaries.length);

    let latestCreatedAt = since;

    for (const chunk of chunkBy(newMeetings, MEETING_CHUNK_SIZE)) {
      const ids = chunk.map((meeting) => meeting.id);
      const details = await readMeetings(mcp, ids);
      const transcripts = await getTranscripts(mcp, ids);

      const records = chunk.map((summary) =>
        buildMeeting(
          summary,
          details.get(String(summary.id)),
          summary.linkId ? transcripts.get(summary.linkId) : undefined,
        ),
      );

      await writer.saveMany(records);
      await writer.flush();

      for (const record of records) {
        latestCreatedAt = laterIso(latestCreatedAt, record.created_at);
      }

      await nango.saveCheckpoint({ lastSyncDate: latestCreatedAt });
    }

    await nango.saveCheckpoint({ lastSyncDate: laterIso(latestCreatedAt, since) });
  },
});

// SearchMeetings returns a plain array per page and paginates by numeric
// pageIndex (starting at 0), with no cursor or total, so paging walks pages
// until one comes back empty.
async function searchMeetings(
  mcp: CirclebackMcpClient,
  metadata: z.infer<typeof MetadataSchema> | undefined,
  since: string,
): Promise<RawMeeting[]> {
  const meetings: RawMeeting[] = [];

  for (let pageIndex = 0; pageIndex < MAX_SEARCH_PAGES; pageIndex++) {
    const args = withoutUndefined({
      intent: SYNC_INTENT,
      pageIndex,
      startDate: toDateOnly(since),
      searchTerm: metadata?.query,
    });
    const page = await mcp.callTool('SearchMeetings', args, RawMeetingListSchema);
    if (page.length === 0) {
      break;
    }
    meetings.push(...page);
  }

  return meetings;
}

async function readMeetings(
  mcp: CirclebackMcpClient,
  meetingIds: Array<string | number>,
): Promise<Map<string, RawMeeting>> {
  const page = await mcp.callTool(
    'ReadMeetings',
    { intent: SYNC_INTENT, meetingIds },
    RawMeetingListSchema,
  );
  return new Map(page.map((meeting) => [String(meeting.id), meeting]));
}

// Transcripts come back as an array keyed by `meetingId`, which is the meeting's
// string linkId (not its numeric id), so the returned map is keyed by linkId.
async function getTranscripts(
  mcp: CirclebackMcpClient,
  meetingIds: Array<string | number>,
): Promise<Map<string, RawTranscriptSegment[]>> {
  const entries = await mcp.callTool(
    'GetTranscriptsForMeetings',
    { intent: SYNC_INTENT, meetingIds },
    TranscriptEntryListSchema,
  );

  const byLinkId = new Map<string, RawTranscriptSegment[]>();
  for (const entry of entries) {
    if (entry.meetingId != null) {
      byLinkId.set(String(entry.meetingId), entry.transcript ?? []);
    }
  }
  return byLinkId;
}

function buildMeeting(
  summary: RawMeeting,
  details: RawMeeting | undefined,
  transcriptSegments: RawTranscriptSegment[] | undefined,
): CirclebackMeeting {
  const merged = { ...summary, ...withoutUndefined(details ?? {}) };
  const title = firstNonEmpty(merged.name) ?? 'Untitled meeting';
  const createdAt = toIso(merged.createdAt);
  const attendees = mapAttendees(merged.attendees);
  const tags = uniqueStrings(merged.tags ?? []);
  const transcript = mapTranscript(transcriptSegments ?? []);

  return CirclebackMeetingSchema.parse(
    withoutUndefined({
      id: String(merged.id),
      body: renderBody(title, createdAt, merged, attendees),
      title,
      url: merged.url ?? undefined,
      created_at: createdAt,
      duration_seconds:
        typeof merged.duration === 'number' ? Math.round(merged.duration) : undefined,
      attendees: attendees.length > 0 ? attendees : undefined,
      tags: tags.length > 0 ? tags : undefined,
      transcript,
    }),
  );
}

function mapAttendees(attendees: RawAttendee[] | null | undefined): CirclebackAttendee[] {
  return (attendees ?? [])
    .map((attendee) =>
      withoutUndefined({
        name: firstNonEmpty(attendee.name, attendee.email) ?? 'unknown',
        email: attendee.email ?? undefined,
      }),
    )
    .filter((attendee) => attendee.name !== 'unknown' || attendee.email);
}

function mapTranscript(segments: RawTranscriptSegment[]): CirclebackTranscriptSegment[] {
  return segments
    .map((segment) =>
      withoutUndefined({
        speaker: firstNonEmpty(segment.speaker) ?? 'Unknown',
        text: (segment.text ?? '').trim(),
        offset_seconds: segment.timestamp ?? undefined,
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

  lines.push('', '## Summary', '', firstNonEmpty(meeting.notes) ?? '(no summary)');

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

function isNewerThan(timestamp: string | null | undefined, since: string): boolean {
  if (!timestamp) {
    return true;
  }

  return Date.parse(timestamp) > Date.parse(since);
}

function laterIso(current: string, candidate: string): string {
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function toIso(value: string | null | undefined): string {
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

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0) ?? undefined;
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
