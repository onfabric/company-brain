import { afterEach, describe, expect, it, mock, setDefaultTimeout, spyOn } from 'bun:test';

import { NangoSyncMock } from '../../test-support/nango-sync-mock.js';
import createSync, { type NangoSyncLocal } from '../syncs/meetings.js';

// The MCP client throttles requests to respect Circleback's rate limit, so each
// exec drives several real inter-request delays.
const TEST_TIMEOUT_MS = 30_000;
setDefaultTimeout(TEST_TIMEOUT_MS);

const CirclebackMeetingModel = createSync.models.CirclebackMeeting;

function asNango(mock: NangoSyncMock): NangoSyncLocal {
  return mock as unknown as NangoSyncLocal;
}

describe('circleback meetings sync tests', () => {
  const createTestContext = (name = 'meetings') => {
    const nangoMock = new NangoSyncMock({ dirname: __dirname, name });

    return {
      nangoMock: asNango(nangoMock),
      batchSaveSpy: spyOn(nangoMock, 'batchSave'),
      postSpy: spyOn(nangoMock, 'post'),
    };
  };

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
  });

  it('builds a self-contained meeting record with the summary as body', async () => {
    const { nangoMock, batchSaveSpy, postSpy } = createTestContext();

    await createSync.exec(nangoMock);

    const methods = postSpy.mock.calls.map(([config]) => {
      const data = (config as { data?: { method?: string } }).data;
      return data?.method;
    });
    expect(methods[0]).toBe('initialize');
    expect(methods).toContain('notifications/initialized');

    const savedMeetings = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'CirclebackMeeting' ? call[0] : [],
    );
    const [meeting] = JSON.parse(JSON.stringify(savedMeetings));

    expect(savedMeetings).toHaveLength(1);
    expectCirclebackMeetingSchema(meeting);
    expect(meeting).toMatchObject({
      id: '8887844',
      title: 'Weekly product sync',
      url: 'https://meet.google.com/abc-defg-hij',
      created_at: '2025-11-20T15:00:04.721Z',
      duration_seconds: 1831,
      tags: ['product', 'weekly'],
      attendees: [
        { name: 'Ada Lovelace', email: 'ada@onfabric.io' },
        { name: 'Alan Turing', email: 'alan@onfabric.io' },
      ],
      transcript: [
        {
          speaker: 'Ada Lovelace',
          text: "Let's start with the retrieval sync.",
          offset_seconds: 0,
        },
        { speaker: 'Alan Turing', text: "I'll own the schema draft.", offset_seconds: 12.5 },
      ],
    });

    expect(meeting.body.startsWith('# Weekly product sync')).toBe(true);
    expect(meeting.body.includes('## Summary')).toBe(true);
    expect(meeting.body.includes('Shipped the retrieval sync this week.')).toBe(true);
    expect(meeting.body.includes('Ada to draft the schema.')).toBe(true);
    expect(meeting.body.includes('- Duration: 31m')).toBe(true);
    expect(meeting.body.includes('Ada Lovelace <ada@onfabric.io>')).toBe(true);

    expect(meeting.body.includes("Let's start with the retrieval sync.")).toBe(false);
  });

  it('passes the required intent to every Circleback MCP tool call', async () => {
    const { nangoMock, postSpy } = createTestContext();

    await createSync.exec(nangoMock);

    const toolCalls = postSpy.mock.calls
      .map(([config]) => (config as { data?: { method?: string; params?: unknown } }).data)
      .filter((data) => data?.method === 'tools/call')
      .map((data) => data?.params as { name: string; arguments: { intent?: unknown } });

    expect(toolCalls.map((call) => call.name)).toEqual([
      'SearchMeetings',
      'SearchMeetings',
      'ReadMeetings',
      'GetTranscriptsForMeetings',
    ]);
    for (const call of toolCalls) {
      expect(typeof call.arguments.intent).toBe('string');
    }
  });

  it('skips meetings older than the checkpoint', async () => {
    const { nangoMock, batchSaveSpy } = createTestContext();

    await createSync.exec(nangoMock);

    const savedIds = batchSaveSpy.mock.calls
      .flatMap((call) => (call[1] === 'CirclebackMeeting' ? call[0] : []))
      .map((meeting) => (meeting as { id: string }).id);

    expect(savedIds).toEqual(['8887844']);
    expect(savedIds).not.toContain('7000001');
  });

  it('keeps raw provider details out of the saved record', async () => {
    const { nangoMock, batchSaveSpy } = createTestContext();

    await createSync.exec(nangoMock);

    const [meeting] = JSON.parse(
      JSON.stringify(
        batchSaveSpy.mock.calls.flatMap((call) => (call[1] === 'CirclebackMeeting' ? call[0] : [])),
      ),
    );

    expect('notes' in meeting).toBe(false);
    expect('summary' in meeting).toBe(false);
    expect('recordingUrl' in meeting).toBe(false);
    expect('meetingId' in meeting).toBe(false);
    expect(JSON.stringify(meeting).includes('structuredContent')).toBe(false);
  });
});

function expectCirclebackMeetingSchema(value: unknown): void {
  const parsed = CirclebackMeetingModel.parse(value);
  expect(parsed).toStrictEqual(value as typeof parsed);
}
