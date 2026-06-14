import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { NangoSyncMock } from '../../test-support/nango-sync-mock.js';
import createSync, { type NangoSyncLocal } from '../syncs/threads.js';

const GmailThreadModel = createSync.models.GmailThread;

type BackendNotification = {
  url: URL;
  method?: string;
  body?: string | null;
};

function asNango(mock: NangoSyncMock): NangoSyncLocal {
  return mock as unknown as NangoSyncLocal;
}

describe('gmail thread sync tests', () => {
  const createTestContext = (name = 'threads') => {
    const nangoMock = new NangoSyncMock({
      dirname: __dirname,
      name,
    });

    return {
      nangoMock: asNango(nangoMock),
      batchSaveSpy: spyOn(nangoMock, 'batchSave'),
      batchDeleteSpy: spyOn(nangoMock, 'batchDelete'),
      saveCheckpointSpy: spyOn(nangoMock, 'saveCheckpoint'),
      uncontrolledFetchSpy: spyOn(nangoMock, 'uncontrolledFetch'),
      getSpy: spyOn(nangoMock, 'get'),
    };
  };

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
  });

  it('should build readable Gmail thread records', async () => {
    const { nangoMock, batchSaveSpy, saveCheckpointSpy, uncontrolledFetchSpy, getSpy } =
      createTestContext();

    await createSync.exec(nangoMock);

    const savedThreads = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'GmailThread' ? call[0] : [],
    );
    const [thread, secondPageThread] = JSON.parse(JSON.stringify(savedThreads));
    const threadListCalls = getSpy.mock.calls.filter(
      ([config]) => config.endpoint === '/gmail/v1/users/me/threads',
    );
    const checkpointCalls = saveCheckpointSpy.mock.calls.map(([checkpoint]) => checkpoint);
    const backendNotifications = uncontrolledFetchSpy.mock.calls.map(
      ([options]) => options as BackendNotification,
    );
    const notificationBodies = backendNotifications.map((notification) =>
      JSON.parse(notification.body ?? '{}'),
    );
    const threadGetCall = getSpy.mock.calls.find(
      ([config]) => config.endpoint === '/gmail/v1/users/me/threads/thread-1',
    );
    const secondPageThreadGetCall = getSpy.mock.calls.find(
      ([config]) => config.endpoint === '/gmail/v1/users/me/threads/thread-2',
    );

    expect(savedThreads).toHaveLength(2);
    expect(threadListCalls).toHaveLength(2);
    expect(threadListCalls[0]?.[0].params).toMatchObject({ includeSpamTrash: 'true' });
    expect(threadListCalls[1]?.[0].params).toMatchObject({
      includeSpamTrash: 'true',
      pageToken: 'page-2',
    });
    expect(threadGetCall?.[0].params).toMatchObject({ format: 'full' });
    expect(secondPageThreadGetCall?.[0].params).toMatchObject({ format: 'full' });
    expect(checkpointCalls).toContainEqual({
      phase: 'backfill',
      history_id: '',
      page_token: 'page-2',
      backfill_history_id: '900',
    });
    expect(checkpointCalls.at(-1)).toEqual({
      phase: 'history',
      history_id: '900',
      page_token: '',
      backfill_history_id: '',
    });
    expect(backendNotifications).toHaveLength(batchSaveSpy.mock.calls.length);
    expect(backendNotifications.map((notification) => notification.method)).toEqual([
      'POST',
      'POST',
    ]);
    expect(backendNotifications.map((notification) => notification.url.pathname)).toEqual([
      '/api/webhooks/batch-save',
      '/api/webhooks/batch-save',
    ]);
    expect(notificationBodies).toEqual([
      {
        nango_integration_id: 'test-provider',
        connection_id: 1,
        model: 'GmailThread',
        ids: ['thread-1'],
      },
      {
        nango_integration_id: 'test-provider',
        connection_id: 1,
        model: 'GmailThread',
        ids: ['thread-2'],
      },
    ]);
    expectGmailThreadSchema(thread);
    expectGmailThreadSchema(secondPageThread);
    expect(secondPageThread).toMatchObject({
      id: 'thread-2',
      mailbox: 'me@example.com',
      subject: 'Second page',
      labels: ['INBOX'],
      participants: ['carol@example.com', 'me@example.com'],
    });
    expect(secondPageThread.body).toContain('Second page message');
    expect(thread).toStrictEqual({
      id: 'thread-1',
      body:
        '# Gmail thread: Launch docs\n' +
        '\n' +
        '- Mailbox: me@example.com\n' +
        '- Started: 2025-11-01T09:30:00.000Z\n' +
        '- Last activity: 2025-11-01T10:00:00.000Z\n' +
        '- Labels: INBOX, Projects/Launch, SENT\n' +
        '- Participants: alice@example.com, bob@example.com, me@example.com\n' +
        '\n' +
        '## 2025-11-01T09:30:00.000Z - alice@example.com\n' +
        '\n' +
        'To: me@example.com\n' +
        'Cc: bob@example.com\n' +
        'Subject: Launch docs\n' +
        'Labels: INBOX, Projects/Launch\n' +
        '\n' +
        'Hi team,\n' +
        'Here are the launch docs: https://company.example/launch\n' +
        '\n' +
        'Attachments:\n' +
        '- launch-plan.pdf - application/pdf - 4567 bytes\n' +
        '\n' +
        '## 2025-11-01T10:00:00.000Z - me@example.com\n' +
        '\n' +
        'To: alice@example.com, bob@example.com\n' +
        'Subject: Re: Launch docs\n' +
        'Labels: Projects/Launch, SENT\n' +
        '\n' +
        'Thanks Alice.\n' +
        'I added notes.',
      mailbox: 'me@example.com',
      subject: 'Launch docs',
      labels: ['INBOX', 'Projects/Launch', 'SENT'],
      created_at: '2025-11-01T09:30:00.000Z',
      updated_at: '2025-11-01T10:00:00.000Z',
      participants: ['alice@example.com', 'bob@example.com', 'me@example.com'],
      messages: [
        {
          sent_at: '2025-11-01T09:30:00.000Z',
          from: 'alice@example.com',
          to: ['me@example.com'],
          cc: ['bob@example.com'],
          subject: 'Launch docs',
          labels: ['INBOX', 'Projects/Launch'],
          text: 'Hi team,\nHere are the launch docs: https://company.example/launch',
          attachments: [
            {
              filename: 'launch-plan.pdf',
              mime_type: 'application/pdf',
              size: 4567,
            },
          ],
        },
        {
          sent_at: '2025-11-01T10:00:00.000Z',
          from: 'me@example.com',
          to: ['alice@example.com', 'bob@example.com'],
          subject: 'Re: Launch docs',
          labels: ['Projects/Launch', 'SENT'],
          text: 'Thanks Alice.\nI added notes.',
        },
      ],
    });

    const recordJson = JSON.stringify(thread);
    expect(recordJson.includes('ATTACHMENT_SHOULD_NOT_BE_SAVED')).toBe(false);
    expect(recordJson.includes('payload')).toBe(false);
    expect(recordJson.includes('historyId')).toBe(false);
    expect(recordJson.includes('threadId')).toBe(false);
    expect(recordJson.includes('sizeEstimate')).toBe(false);
    expect(recordJson.includes('SGkgdGV')).toBe(false);
  });

  it('should refresh changed threads from Gmail history', async () => {
    const { nangoMock, batchSaveSpy, batchDeleteSpy, getSpy } = createTestContext('history');

    await createSync.exec(nangoMock);

    const savedThreads = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'GmailThread' ? call[0] : [],
    );
    const deletedThreads = batchDeleteSpy.mock.calls.flatMap((call) =>
      call[1] === 'GmailThread' ? call[0] : [],
    );
    const requestedEndpoints = getSpy.mock.calls.map(([config]) => config.endpoint);

    expect(savedThreads).toHaveLength(1);
    expect(savedThreads[0]).toMatchObject({
      id: 'thread-2',
      subject: 'History refresh',
      participants: ['carol@example.com', 'me@example.com'],
    });
    expect(deletedThreads).toEqual([{ id: 'thread-3' }]);
    expect(requestedEndpoints).toContain('/gmail/v1/users/me/history');
    expect(requestedEndpoints).toContain('/gmail/v1/users/me/threads/thread-2');
    expect(requestedEndpoints).toContain('/gmail/v1/users/me/threads/thread-3');
  });
});

function expectGmailThreadSchema(value: unknown): void {
  const parsed = GmailThreadModel.parse(value);
  expect(parsed).toStrictEqual(value as typeof parsed);
}
