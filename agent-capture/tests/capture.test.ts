import { afterEach, describe, expect, it, mock } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { captureHookEvent, makeHookEnvelope } from '../src/capture.js';
import { resolveInstallTargets } from '../src/install-hooks.js';
import { pushConversationIfConfigured } from '../src/nango-push.js';
import { scanLocalSessions } from '../src/session-scanner.js';
import { AgentCaptureStore } from '../src/store.js';
import { parseTranscriptFile } from '../src/transcript-parser.js';

const TEMP_PREFIX = 'company-brain-agent-capture-';
const CODEX_SESSION_DIR_ENV = 'COMPANY_BRAIN_CODEX_SESSION_DIR';
const CLAUDE_CODE_PROJECTS_DIR_ENV = 'COMPANY_BRAIN_CLAUDE_CODE_PROJECTS_DIR';
const NANGO_WEBHOOK_URL_ENV = 'COMPANY_BRAIN_NANGO_WEBHOOK_URL';
const NANGO_CONNECTION_ID_ENV = 'COMPANY_BRAIN_NANGO_CONNECTION_ID';
const NANGO_WEBHOOK_SECRET_ENV = 'COMPANY_BRAIN_NANGO_WEBHOOK_SECRET';

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;
type PushedBody = {
  records?: unknown;
  type?: unknown;
  connectionId?: unknown;
  secret?: unknown;
};

describe('agent capture', () => {
  afterEach(async () => {
    delete process.env[CODEX_SESSION_DIR_ENV];
    delete process.env[CLAUDE_CODE_PROJECTS_DIR_ENV];
    delete process.env[NANGO_WEBHOOK_URL_ENV];
    delete process.env[NANGO_CONNECTION_ID_ENV];
    delete process.env[NANGO_WEBHOOK_SECRET_ENV];
    globalThis.fetch = originalFetch;
    mock.clearAllMocks();
    await Promise.all(
      tempDirs
        .splice(0)
        .map((tempDir) => fs.promises.rm(tempDir, { recursive: true, force: true })),
    );
  });

  it('builds a whole Claude Code conversation from a transcript path', async () => {
    const tempDir = await makeTempDir();
    const transcriptPath = path.join(tempDir, 'claude.jsonl');
    await fs.promises.writeFile(
      transcriptPath,
      [
        JSON.stringify({
          type: 'user',
          sessionId: 'claude-session-1',
          timestamp: '2026-06-01T09:00:00.000Z',
          cwd: tempDir,
          message: { role: 'user', content: 'Fix the sync and rerun the tests' },
        }),
        JSON.stringify({
          type: 'assistant',
          sessionId: 'claude-session-1',
          timestamp: '2026-06-01T09:00:05.000Z',
          cwd: tempDir,
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'I will inspect the sync first.' }],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          sessionId: 'claude-session-1',
          timestamp: '2026-06-01T09:00:07.000Z',
          cwd: tempDir,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                name: 'Edit',
                input: { file_path: path.join(tempDir, 'sync.ts') },
              },
            ],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          sessionId: 'claude-session-1',
          timestamp: '2026-06-01T09:01:00.000Z',
          cwd: tempDir,
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'The sync is fixed and tests pass.' }],
          },
        }),
      ].join('\n'),
    );

    const store = new AgentCaptureStore(tempDir);
    const conversation = await captureHookEvent(
      store,
      makeHookEnvelope('claude-code', {
        hook_event_name: 'Stop',
        session_id: 'claude-session-1',
        transcript_path: transcriptPath,
        cwd: tempDir,
        last_assistant_message: 'The sync is fixed and tests pass.',
      }),
    );

    expect(conversation.id).toBe('claude-code:claude-session-1');
    expect(conversation.messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'assistant',
    ]);
    expect(conversation.tools_used).toEqual(['Edit']);
    expect(conversation.files_touched).toContain(path.join(tempDir, 'sync.ts'));
    expect(conversation.body).toContain('Fix the sync and rerun the tests');
    expect(conversation.body).toContain('The sync is fixed and tests pass.');
  });

  it('parses Codex response items without storing developer instructions', async () => {
    const tempDir = await makeTempDir();
    const transcriptPath = path.join(tempDir, 'codex.jsonl');
    await fs.promises.writeFile(
      transcriptPath,
      [
        JSON.stringify({
          timestamp: '2026-06-01T10:00:00.000Z',
          type: 'session_meta',
          payload: { id: 'codex-session-1', cwd: tempDir, timestamp: '2026-06-01T10:00:00.000Z' },
        }),
        JSON.stringify({
          timestamp: '2026-06-01T10:00:01.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '# AGENTS.md instructions for /tmp/repo\n\n<INSTRUCTIONS>\nDo not index me\n</INSTRUCTIONS><environment_context>\n  <cwd>/tmp/repo</cwd>\n</environment_context>',
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: '2026-06-01T10:00:02.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'developer',
            content: [{ type: 'input_text', text: 'Do not index me' }],
          },
        }),
        JSON.stringify({
          timestamp: '2026-06-01T10:00:03.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'Summarize this repo' }],
          },
        }),
        JSON.stringify({
          timestamp: '2026-06-01T10:00:04.000Z',
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'call-1',
            name: 'functions.exec_command',
            arguments: JSON.stringify({
              cmd: 'sed -n 1,20p README.md',
              path: path.join(tempDir, 'README.md'),
            }),
          },
        }),
        JSON.stringify({
          timestamp: '2026-06-01T10:00:05.000Z',
          type: 'response_item',
          payload: { type: 'function_call_output', call_id: 'call-1', output: 'README contents' },
        }),
        JSON.stringify({
          timestamp: '2026-06-01T10:00:06.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Here is the summary.' }],
          },
        }),
      ].join('\n'),
    );

    const parsed = await parseTranscriptFile(transcriptPath, 'codex');

    expect(parsed.session_id).toBe('codex-session-1');
    expect(parsed.messages.map((message) => message.role)).toEqual([
      'user',
      'tool',
      'tool',
      'assistant',
    ]);
    expect(parsed.messages.some((message) => message.text.includes('Do not index me'))).toBe(false);
    expect(parsed.tools_used).toEqual(['functions.exec_command']);
    expect(parsed.files_touched).toContain(path.join(tempDir, 'README.md'));
  });

  it('builds hook fallback records without caching normalized conversations', async () => {
    const tempDir = await makeTempDir();
    const store = new AgentCaptureStore(tempDir);

    const conversation = await captureHookEvent(
      store,
      makeHookEnvelope('codex', {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'codex-session-2',
        prompt: 'Build the collector',
        timestamp: '2026-06-01T11:00:00.000Z',
      }),
    );

    expect(conversation.body).toContain('Build the collector');
    expect(fs.existsSync(path.join(tempDir, 'conversations'))).toBe(false);
  });

  it('installs both hook targets when no target flag is passed', () => {
    expect(resolveInstallTargets({ claude: false, codex: false })).toEqual({
      claude: true,
      codex: true,
    });
    expect(resolveInstallTargets({ claude: true, codex: false })).toEqual({
      claude: true,
      codex: false,
    });
  });

  it('scans local Codex session transcripts when hooks are skipped', async () => {
    const tempDir = await makeTempDir();
    const sessionRoot = path.join(tempDir, 'sessions');
    const sessionDir = path.join(sessionRoot, '2026/06/01');
    const transcriptPath = path.join(sessionDir, 'rollout-test.jsonl');
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(
      transcriptPath,
      [
        JSON.stringify({
          timestamp: '2026-06-01T12:00:00.000Z',
          type: 'session_meta',
          payload: {
            id: 'codex-scanned-session',
            cwd: tempDir,
            timestamp: '2026-06-01T12:00:00.000Z',
          },
        }),
        JSON.stringify({
          timestamp: '2026-06-01T12:00:01.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'test codex hook' }],
          },
        }),
      ].join('\n'),
    );
    process.env[CODEX_SESSION_DIR_ENV] = sessionRoot;
    process.env[CLAUDE_CODE_PROJECTS_DIR_ENV] = path.join(tempDir, 'empty-claude-projects');
    const bodies = enableNangoPush();

    const store = new AgentCaptureStore(tempDir);
    const result = await scanLocalSessions(store);
    const record = (bodies[0]?.records as unknown[])[0] as { body?: string; id?: string };

    expect(result).toEqual({ scanned: 1, captured: 1 });
    expect(record.id).toBe('codex:codex-scanned-session');
    expect(record.body).toContain('test codex hook');
    expect(fs.existsSync(path.join(tempDir, 'conversations'))).toBe(false);
  });

  it('scans local Claude Code project transcripts', async () => {
    const tempDir = await makeTempDir();
    const projectsRoot = path.join(tempDir, 'claude-projects');
    const transcriptPath = path.join(projectsRoot, 'project/session.jsonl');
    await fs.promises.mkdir(path.dirname(transcriptPath), { recursive: true });
    await fs.promises.writeFile(
      transcriptPath,
      [
        JSON.stringify({
          type: 'user',
          sessionId: 'claude-scanned-session',
          timestamp: '2026-06-01T12:30:00.000Z',
          cwd: tempDir,
          message: { role: 'user', content: 'scan my claude history' },
        }),
        JSON.stringify({
          type: 'assistant',
          sessionId: 'claude-scanned-session',
          timestamp: '2026-06-01T12:30:05.000Z',
          cwd: tempDir,
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Claude history scanned.' }],
          },
        }),
      ].join('\n'),
    );
    process.env[CODEX_SESSION_DIR_ENV] = path.join(tempDir, 'empty-codex-sessions');
    process.env[CLAUDE_CODE_PROJECTS_DIR_ENV] = projectsRoot;
    const bodies = enableNangoPush();

    const store = new AgentCaptureStore(tempDir);
    const result = await scanLocalSessions(store);
    const record = (bodies[0]?.records as unknown[])[0] as { body?: string; id?: string };

    expect(result).toEqual({ scanned: 1, captured: 1 });
    expect(record.id).toBe('claude-code:claude-scanned-session');
    expect(record.body).toContain('scan my claude history');
    expect(record.body).toContain('Claude history scanned.');
    expect(fs.existsSync(path.join(tempDir, 'conversations'))).toBe(false);
  });

  it('pushes changed conversations to Nango once', async () => {
    const tempDir = await makeTempDir();
    const bodies = enableNangoPush();

    const store = new AgentCaptureStore(tempDir);
    const conversation = await captureHookEvent(
      store,
      makeHookEnvelope('codex', {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'codex-push-session',
        prompt: 'Send this to Nango',
        timestamp: '2026-06-01T13:00:00.000Z',
      }),
    );

    const first = await pushConversationIfConfigured(store, conversation);
    const second = await pushConversationIfConfigured(store, conversation);

    expect(first).toMatchObject({ status: 'pushed', pushed: 1, skipped: 0 });
    expect(second).toMatchObject({ status: 'skipped', pushed: 0, skipped: 1 });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      type: 'agent.conversation.upsert',
      connectionId: 'local-agent-capture',
      secret: 'shared-secret',
    });
    expect((bodies[0]?.records as unknown[])[0]).toMatchObject({
      id: 'codex:codex-push-session',
      body: expect.stringContaining('Send this to Nango'),
    });
  });
});

function enableNangoPush(): PushedBody[] {
  const bodies: PushedBody[] = [];
  process.env[NANGO_WEBHOOK_URL_ENV] = 'https://nango.test/webhook/env/agent-conversations';
  process.env[NANGO_CONNECTION_ID_ENV] = 'local-agent-capture';
  process.env[NANGO_WEBHOOK_SECRET_ENV] = 'shared-secret';
  globalThis.fetch = mock((_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as PushedBody);
    return Promise.resolve(new Response(JSON.stringify({ ok: true })));
  }) as unknown as typeof fetch;
  return bodies;
}

async function makeTempDir(): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  tempDirs.push(tempDir);
  return tempDir;
}
