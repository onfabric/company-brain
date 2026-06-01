import { describe, expect, it, spyOn } from 'bun:test';

import { NangoSyncMock } from '../../test-support/nango-sync-mock.js';
import createSync, { type NangoSyncLocal } from '../syncs/conversations.js';

const AgentConversationModel = createSync.models.AgentConversation;

function asNango(mock: NangoSyncMock): NangoSyncLocal {
  return mock as unknown as NangoSyncLocal;
}

describe('agent conversations sync tests', () => {
  it('saves whole conversations received through Nango webhooks', async () => {
    const nangoMock = new NangoSyncMock({ dirname: __dirname, name: 'conversations' });
    const batchSaveSpy = spyOn(nangoMock, 'batchSave');

    await createSync.onWebhook?.(asNango(nangoMock), {
      type: 'agent.conversation.upsert',
      connectionId: 'local-agent-sync',
      sentAt: '2026-06-01T09:31:00.000Z',
      secret: 'shared-secret',
      records: [
        conversationRecord('codex:webhook-one', 'codex-webhook-1', '2026-06-01T09:31:00.000Z'),
      ],
    });

    const saved = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'AgentConversation' ? call[0] : [],
    );
    const [record] = JSON.parse(JSON.stringify(saved));

    expect(saved).toHaveLength(1);
    expectAgentConversationSchema(record);
    expect(record.body.startsWith('# Codex conversation')).toBe(true);
    expect(record.body).toContain('Earlier context');
    expect(record.body).toContain('Latest answer');
    expect(record.body).not.toContain('## Tool trajectory');
    expect(record.body).not.toContain('exec_command');
    expect(record.body).not.toContain('# Captured conversation');
    expect(record.body).not.toContain('Files touched');
    expect(record.body).not.toContain('/Users/massimo/company-brain/package.json');
    expect(record.body).not.toContain('raw command output');
  });
});

function conversationRecord(id: string, sessionId: string, updatedAt: string): unknown {
  return {
    id,
    body: '# Captured conversation\n\nEarlier context\n\n{"cmd":"cat package.json"}\n\nraw command output\n\nLatest answer\n\nFiles touched: /Users/massimo/company-brain/package.json',
    source: id.startsWith('codex') ? 'codex' : 'claude-code',
    session_id: sessionId,
    user_identifier: 'massimo',
    workspace: 'company-brain',
    repo: 'company-brain',
    cwd: '/Users/massimo/company-brain',
    title: 'Earlier context',
    started_at: '2026-06-01T09:10:00.000Z',
    updated_at: updatedAt,
    messages: [
      {
        role: 'user',
        text: 'Earlier context',
        created_at: '2026-06-01T09:10:00.000Z',
      },
      {
        role: 'assistant',
        text: 'Latest answer',
        created_at: '2026-06-01T09:11:00.000Z',
      },
      {
        role: 'tool',
        text: '{"cmd":"cat package.json"}',
        created_at: '2026-06-01T09:11:15.000Z',
        tool_name: 'functions.exec_command',
        files: ['/Users/massimo/company-brain/package.json'],
      },
    ],
    tools_used: ['functions.exec_command'],
    files_touched: ['/Users/massimo/company-brain/package.json'],
    tool_events: [
      {
        name: 'functions.exec_command',
        created_at: '2026-06-01T09:11:15.000Z',
        input: '{"cmd":"cat package.json"}',
        status: 'started',
        files: ['/Users/massimo/company-brain/package.json'],
      },
      {
        name: 'functions.exec_command',
        created_at: '2026-06-01T09:11:16.000Z',
        output: 'raw command output',
        status: 'completed',
      },
    ],
  };
}

function expectAgentConversationSchema(value: unknown): void {
  const parsed = AgentConversationModel.parse(value);
  expect(parsed).toStrictEqual(value as typeof parsed);
}
