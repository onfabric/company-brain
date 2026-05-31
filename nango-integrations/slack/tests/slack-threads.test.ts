import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { NangoSyncMock } from '../../test-support/nango-sync-mock.js';
import createSync, { type NangoSyncLocal } from '../syncs/threads.js';

const SlackThreadModel = createSync.models.SlackThread;

// NangoSyncMock implements only the slice of the Nango SDK the sync exercises.
// The real surface is generic and Axios-based, so the mock cannot structurally
// satisfy it without replicating the whole SDK; widen once at this boundary.
function asNango(mock: NangoSyncMock): NangoSyncLocal {
  return mock as unknown as NangoSyncLocal;
}

describe('slack threads tests', () => {
  const createTestContext = (name = 'threads') => {
    const nangoMock = new NangoSyncMock({
      dirname: __dirname,
      name,
    });

    return {
      nangoMock: asNango(nangoMock),
      batchSaveSpy: spyOn(nangoMock, 'batchSave'),
    };
  };

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
  });

  it('should build readable Slack thread records', async () => {
    const { nangoMock, batchSaveSpy } = createTestContext();

    await createSync.exec(nangoMock);

    const savedThreads = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'SlackThread' ? call[0] : [],
    );
    const [thread, standalone] = JSON.parse(JSON.stringify(savedThreads));

    expect(savedThreads).toHaveLength(2);
    expectSlackThreadSchema(thread);
    expectSlackThreadSchema(standalone);
    expect(thread).toMatchObject({
      id: 'C123-1700000100.123456',
      channel: 'engineering',
      messages: [
        {
          author: { name: 'Alice', email: 'alice@example.com' },
          text: 'Deploy check @Bob Builder deploy notes (https://example.com/deploy)',
          mentions: [{ name: 'Bob Builder', email: 'bob@example.com' }],
          reactions: [
            {
              name: 'white_check_mark',
              actors: [{ name: 'Bob Builder', email: 'bob@example.com' }],
            },
          ],
          links: [{ url: 'https://example.com/deploy' }],
        },
        {
          author: { name: 'Bob Builder', email: 'bob@example.com' },
          text: '@Alice looks good',
          mentions: [{ name: 'Alice', email: 'alice@example.com' }],
          reactions: [{ name: 'eyes', actors: [{ name: 'Alice', email: 'alice@example.com' }] }],
        },
        {
          author: { name: 'DeployBot' },
          text: 'Deployment finished',
          files: [
            {
              author: { name: 'DeployBot' },
              created_at: '2023-11-14T22:15:05.000Z',
              permalink: 'https://example.slack.com/files/F1',
            },
          ],
        },
      ],
    });
    expect(standalone).toMatchObject({
      id: 'C123-1700000000.500000',
      messages: [
        {
          author: { name: 'Bob Builder', email: 'bob@example.com' },
          text: 'Standalone note for @Alice http://example.com/report',
          reactions: [{ name: '+1', actors: [{ name: 'Alice', email: 'alice@example.com' }] }],
        },
      ],
    });
    const messageJson = JSON.stringify(thread.messages);
    expect(typeof thread.body).toBe('string');
    expect(thread.body.startsWith('# Slack thread in #engineering')).toBe(true);
    expect(thread.body.includes('## 2023-11-14T22:15:00.123Z - Alice <alice@example.com>')).toBe(
      true,
    );
    expect(thread.body.includes('Mentions: Bob Builder <bob@example.com>')).toBe(true);
    expect(thread.body.includes('- white_check_mark by Bob Builder <bob@example.com>')).toBe(true);
    expect(
      thread.body.includes(
        '- 2023-11-14T22:15:05.000Z - DeployBot - https://example.slack.com/files/F1',
      ),
    ).toBe(true);
    expect(messageJson.includes('blocks')).toBe(false);
    expect(messageJson.includes('attachments')).toBe(false);
    expect(messageJson.includes('"id"')).toBe(false);
    expect(messageJson.includes('"kind"')).toBe(false);
    expect(messageJson.includes('"label"')).toBe(false);
    expect(messageJson.includes('"url_private"')).toBe(false);
    expect(thread.body.includes('<@')).toBe(false);
    expect('source' in thread).toBe(false);
    expect('counts' in thread).toBe(false);
    expect('participants' in thread).toBe(false);
    expect('mentioned_people' in thread).toBe(false);
    expect('title' in thread).toBe(false);
    expect(messageJson.includes('"source"')).toBe(false);
    expect(messageJson.includes('"count"')).toBe(false);
  });

  it('should map a realistic Slack planning thread to the SlackThread schema', async () => {
    const { nangoMock, batchSaveSpy } = createTestContext('realistic-threads');

    await createSync.exec(nangoMock);

    const savedThreads = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'SlackThread' ? call[0] : [],
    );
    const [thread] = JSON.parse(JSON.stringify(savedThreads));

    expect(savedThreads).toHaveLength(1);
    expectSlackThreadSchema(thread);
    expect(thread).toStrictEqual({
      id: 'C999-1761923700.772849',
      body:
        '# Slack thread in #product-launch\n' +
        '\n' +
        '- Started: 2025-10-31T15:15:00.772Z\n' +
        '- Last activity: 2025-10-31T15:19:10.000Z\n' +
        '\n' +
        '## 2025-10-31T15:15:00.772Z - Maya Chen <maya@example.com>\n' +
        '\n' +
        '*Launch planning for Monday-Wednesday:*\n' +
        '• Website @Alex Rivera, needed by EOD Tuesday\n' +
        '• QA pass on onboarding @Priya Shah\n' +
        '• Retrieval demo plan @Priya Shah\n' +
        'Docs: launch plan (https://company.example/launch-plan)\n' +
        'Keeping this in #product-launch. Anything else?\n' +
        '\n' +
        'Mentions: Alex Rivera <alex@example.com>, Priya Shah <priya@example.com>\n' +
        '\n' +
        'Reactions:\n' +
        '- +1 by Alex Rivera <alex@example.com>, Priya Shah <priya@example.com>\n' +
        '\n' +
        '## 2025-10-31T15:16:31.682Z - Alex Rivera <alex@example.com>\n' +
        '\n' +
        "I'm blocked on final copy but can ship by Tuesday. @Maya Chen please confirm homepage hero.\n" +
        '\n' +
        'Mentions: Maya Chen <maya@example.com>\n' +
        '\n' +
        'Reactions:\n' +
        '- eyes by Maya Chen <maya@example.com>\n' +
        '\n' +
        '## 2025-10-31T15:18:04.123Z - Priya Shah <priya@example.com>\n' +
        '\n' +
        "QA plan is here: https://company.example/qa-checklist\nI'll cover onboarding and retrieval.\n" +
        '\n' +
        'Files:\n' +
        '- 2025-10-31T15:17:55.000Z - Priya Shah <priya@example.com> - https://example.slack.com/files/FQA1\n' +
        '\n' +
        '## 2025-10-31T15:19:10.000Z - LaunchBot\n' +
        '\n' +
        'Reminder set for Tuesday 16:00',
      channel: 'product-launch',
      created_at: '2025-10-31T15:15:00.772Z',
      updated_at: '2025-10-31T15:19:10.000Z',
      messages: [
        {
          created_at: '2025-10-31T15:15:00.772Z',
          author: { name: 'Maya Chen', email: 'maya@example.com' },
          text:
            '*Launch planning for Monday-Wednesday:*\n' +
            '• Website @Alex Rivera, needed by EOD Tuesday\n' +
            '• QA pass on onboarding @Priya Shah\n' +
            '• Retrieval demo plan @Priya Shah\n' +
            'Docs: launch plan (https://company.example/launch-plan)\n' +
            'Keeping this in #product-launch. Anything else?',
          mentions: [
            { name: 'Alex Rivera', email: 'alex@example.com' },
            { name: 'Priya Shah', email: 'priya@example.com' },
          ],
          reactions: [
            {
              name: '+1',
              actors: [
                { name: 'Alex Rivera', email: 'alex@example.com' },
                { name: 'Priya Shah', email: 'priya@example.com' },
              ],
            },
          ],
          links: [{ url: 'https://company.example/launch-plan' }],
        },
        {
          created_at: '2025-10-31T15:16:31.682Z',
          author: { name: 'Alex Rivera', email: 'alex@example.com' },
          text: "I'm blocked on final copy but can ship by Tuesday. @Maya Chen please confirm homepage hero.",
          mentions: [{ name: 'Maya Chen', email: 'maya@example.com' }],
          reactions: [{ name: 'eyes', actors: [{ name: 'Maya Chen', email: 'maya@example.com' }] }],
        },
        {
          created_at: '2025-10-31T15:18:04.123Z',
          author: { name: 'Priya Shah', email: 'priya@example.com' },
          text: "QA plan is here: https://company.example/qa-checklist\nI'll cover onboarding and retrieval.",
          files: [
            {
              author: { name: 'Priya Shah', email: 'priya@example.com' },
              created_at: '2025-10-31T15:17:55.000Z',
              permalink: 'https://example.slack.com/files/FQA1',
            },
          ],
          links: [{ url: 'https://company.example/qa-checklist' }],
        },
        {
          created_at: '2025-10-31T15:19:10.000Z',
          author: { name: 'LaunchBot' },
          text: 'Reminder set for Tuesday 16:00',
        },
      ],
    });
  });
});

function expectSlackThreadSchema(value: unknown): void {
  const parsed = SlackThreadModel.parse(value);
  expect(parsed).toStrictEqual(value as typeof parsed);
}
