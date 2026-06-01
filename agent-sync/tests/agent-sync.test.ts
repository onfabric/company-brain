import { afterEach, describe, expect, it, mock } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureTranscriptFile } from '../src/capture.js';
import { loadConfig, writeConfigFile } from '../src/config.js';
import { discoverConversations } from '../src/discovery.js';
import { ensureIdentity } from '../src/identity.js';
import { launchAgentConfig, renderLaunchAgentPlist } from '../src/launchd.js';
import { scanLocalSessions } from '../src/session-scanner.js';
import { AgentSyncStore } from '../src/store.js';
import { parseTranscriptFile } from '../src/transcript-parser.js';

const TEMP_PREFIX = 'company-brain-agent-sync-';
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const INSTALL_SCRIPT_PATH = path.resolve(TEST_DIR, '../../scripts/install-agent-sync.sh');
const CODEX_SESSION_DIR_ENV = 'COMPANY_BRAIN_CODEX_SESSION_DIR';
const CLAUDE_CODE_PROJECTS_DIR_ENV = 'COMPANY_BRAIN_CLAUDE_CODE_PROJECTS_DIR';
const NANGO_WEBHOOK_URL_ENV = 'COMPANY_BRAIN_NANGO_WEBHOOK_URL';
const NANGO_CONNECTION_ID_ENV = 'COMPANY_BRAIN_NANGO_CONNECTION_ID';
const NANGO_WEBHOOK_SECRET_ENV = 'COMPANY_BRAIN_NANGO_WEBHOOK_SECRET';
const SCAN_INTERVAL_ENV = 'COMPANY_BRAIN_AGENT_SYNC_SCAN_INTERVAL_MS';
const ENV_SCAN_INTERVAL_MS = 120_000;
const DEFAULT_NANGO_PUSH_TIMEOUT_MS = 5_000;

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;

type PushedBody = {
  records?: unknown;
  type?: unknown;
  connectionId?: unknown;
  secret?: unknown;
};

describe('agent sync', () => {
  afterEach(async () => {
    delete process.env[CODEX_SESSION_DIR_ENV];
    delete process.env[CLAUDE_CODE_PROJECTS_DIR_ENV];
    delete process.env[NANGO_WEBHOOK_URL_ENV];
    delete process.env[NANGO_CONNECTION_ID_ENV];
    delete process.env[NANGO_WEBHOOK_SECRET_ENV];
    delete process.env[SCAN_INTERVAL_ENV];
    globalThis.fetch = originalFetch;
    mock.clearAllMocks();
    await Promise.all(
      tempDirs
        .splice(0)
        .map((tempDir) => fs.promises.rm(tempDir, { recursive: true, force: true })),
    );
  });

  it('loads config defaults from JSON and lets environment variables override them', async () => {
    const tempDir = await makeTempDir();
    await writeConfigFile(
      {
        nangoWebhookUrl: 'https://config.test/webhook',
        nangoConnectionId: 'config-connection',
        nangoWebhookSecret: 'config-secret',
        scanIntervalMs: 60_000,
      },
      tempDir,
    );
    process.env[NANGO_CONNECTION_ID_ENV] = 'env-connection';
    process.env[SCAN_INTERVAL_ENV] = '120000';

    const config = await loadConfig({ dataDir: tempDir });

    expect(config.nangoWebhookUrl).toBe('https://config.test/webhook');
    expect(config.nangoConnectionId).toBe('env-connection');
    expect(config.nangoWebhookSecret).toBe('config-secret');
    expect(config.scanIntervalMs).toBe(ENV_SCAN_INTERVAL_MS);
    expect(config.nangoPushTimeoutMs).toBe(DEFAULT_NANGO_PUSH_TIMEOUT_MS);
    expect(config.codexSessionDir).toBe(path.join(os.homedir(), '.codex/sessions'));
  });

  it('generates a stable local user identifier', async () => {
    const tempDir = await makeTempDir();

    const first = await ensureIdentity(tempDir);
    const second = await ensureIdentity(tempDir);

    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('parses Codex response items without storing developer instructions', async () => {
    const tempDir = await makeTempDir();
    const transcriptPath = path.join(tempDir, 'codex.jsonl');
    await writeCodexTranscript(transcriptPath, {
      sessionId: 'codex-session-1',
      cwd: tempDir,
      text: 'Summarize this repo',
      assistantText: 'Here is the summary.',
      includeBootstrap: true,
    });

    const parsed = await parseTranscriptFile(transcriptPath, 'codex');

    expect(parsed.session_id).toBe('codex-session-1');
    expect(parsed.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(parsed.messages.some((message) => message.text.includes('Do not index me'))).toBe(false);
  });

  it('builds conversations with the generated user identifier', async () => {
    const tempDir = await makeTempDir();
    const transcriptPath = path.join(tempDir, 'claude.jsonl');
    await writeClaudeTranscript(transcriptPath, {
      sessionId: 'claude-session-1',
      cwd: tempDir,
      text: 'scan my claude history',
      assistantText: 'Claude history scanned.',
    });

    const conversation = await captureTranscriptFile(
      'claude-code',
      transcriptPath,
      'stable-user-id',
    );

    expect(conversation?.id).toBe('claude-code:claude-session-1');
    expect(conversation?.user_identifier).toBe('stable-user-id');
    expect(conversation?.body).toContain('scan my claude history');
    expect(conversation?.body).toContain('Claude history scanned.');
  });

  it('tracks existing first-run conversations without pushing them', async () => {
    const tempDir = await makeTempDir();
    const sessionRoot = path.join(tempDir, 'sessions');
    await writeCodexTranscript(path.join(sessionRoot, 'existing.jsonl'), {
      sessionId: 'existing-session',
      cwd: tempDir,
      text: 'existing first run',
    });
    const bodies = enableNangoPush();
    const config = await testConfig(tempDir, sessionRoot);

    const result = await scanLocalSessions(new AgentSyncStore(tempDir), config);

    expect(result).toMatchObject({ scanned: 1, ignored: 1, pushed: 0, tracked: 1 });
    expect(bodies).toHaveLength(0);
  });

  it('syncs new conversations after the first run', async () => {
    const tempDir = await makeTempDir();
    const sessionRoot = path.join(tempDir, 'sessions');
    await fs.promises.mkdir(sessionRoot, { recursive: true });
    const bodies = enableNangoPush();
    const config = await testConfig(tempDir, sessionRoot);
    const store = new AgentSyncStore(tempDir);
    await scanLocalSessions(store, config);
    await writeCodexTranscript(path.join(sessionRoot, 'new.jsonl'), {
      sessionId: 'new-session',
      cwd: tempDir,
      text: 'new conversation',
    });

    const result = await scanLocalSessions(store, config);
    const record = (bodies[0]?.records as unknown[])[0] as {
      id?: string;
      body?: string;
      user_identifier?: string;
    };

    expect(result).toMatchObject({ scanned: 1, pushed: 1, failed: 0 });
    expect(record.id).toBe('codex:new-session');
    expect(record.body).toContain('new conversation');
    expect(record.user_identifier).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('re-syncs updated conversations and ignores unchanged ones', async () => {
    const tempDir = await makeTempDir();
    const sessionRoot = path.join(tempDir, 'sessions');
    const transcriptPath = path.join(sessionRoot, 'existing.jsonl');
    await writeCodexTranscript(transcriptPath, {
      sessionId: 'update-session',
      cwd: tempDir,
      text: 'original text',
    });
    const bodies = enableNangoPush();
    const config = await testConfig(tempDir, sessionRoot);
    const store = new AgentSyncStore(tempDir);
    await scanLocalSessions(store, config);
    await appendCodexAssistantMessage(transcriptPath, 'new answer');

    const updated = await scanLocalSessions(store, config);
    const unchanged = await scanLocalSessions(store, config);
    const record = (bodies[0]?.records as unknown[])[0] as { body?: string };

    expect(updated).toMatchObject({ scanned: 1, pushed: 1 });
    expect(unchanged).toMatchObject({ scanned: 0, ignored: 1, pushed: 0 });
    expect(record.body).toContain('new answer');
    expect(bodies).toHaveLength(1);
  });

  it('keeps failed pushes pending and retries unchanged conversations', async () => {
    const tempDir = await makeTempDir();
    const sessionRoot = path.join(tempDir, 'sessions');
    await fs.promises.mkdir(sessionRoot, { recursive: true });
    const bodies = enableNangoPush({ failFirst: true });
    const config = await testConfig(tempDir, sessionRoot);
    const store = new AgentSyncStore(tempDir);
    await scanLocalSessions(store, config);
    await writeCodexTranscript(path.join(sessionRoot, 'retry.jsonl'), {
      sessionId: 'retry-session',
      cwd: tempDir,
      text: 'retry me',
    });

    const failed = await scanLocalSessions(store, config);
    const retried = await scanLocalSessions(store, config);

    expect(failed).toMatchObject({ pushed: 0, failed: 1, pending: 1 });
    expect(retried).toMatchObject({ scanned: 1, pushed: 1, failed: 0, pending: 0 });
    expect(bodies).toHaveLength(2);
  });

  it('does not track or push when required Nango config is missing', async () => {
    const tempDir = await makeTempDir();
    const sessionRoot = path.join(tempDir, 'sessions');
    await writeCodexTranscript(path.join(sessionRoot, 'new.jsonl'), {
      sessionId: 'new-session',
      cwd: tempDir,
      text: 'wait for config',
    });
    process.env[CODEX_SESSION_DIR_ENV] = sessionRoot;
    process.env[CLAUDE_CODE_PROJECTS_DIR_ENV] = path.join(tempDir, 'empty-claude');
    const config = await loadConfig({ dataDir: tempDir });

    const result = await scanLocalSessions(new AgentSyncStore(tempDir), config);

    expect(result.setup_needed).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'conversations-state.json'))).toBe(false);
  });

  it('discovers directory summaries without exposing conversation text', async () => {
    const tempDir = await makeTempDir();
    const sessionRoot = path.join(tempDir, 'sessions');
    await writeCodexTranscript(path.join(sessionRoot, '2026/06/01/private.jsonl'), {
      sessionId: 'private-session',
      cwd: tempDir,
      text: 'very private prompt',
      assistantText: 'very private answer',
    });
    const config = await testConfig(tempDir, sessionRoot);

    const result = await discoverConversations(config);
    const serialized = JSON.stringify(result);

    expect(result.directories).toContainEqual(
      expect.objectContaining({
        source: 'codex',
        status: 'found',
        jsonl_file_count: 1,
        session_count: 1,
      }),
    );
    expect(serialized).not.toContain('very private prompt');
    expect(serialized).not.toContain('very private answer');
  });

  it('renders a macOS LaunchAgent plist for the daemon', async () => {
    const tempDir = await makeTempDir();
    const config = launchAgentConfig(tempDir);
    const plist = renderLaunchAgentPlist(config);

    expect(config.label).toBe('dev.company-brain.agent-sync');
    expect(plist).toContain('<key>RunAtLoad</key>');
    expect(plist).toContain('<key>KeepAlive</key>');
    expect(plist).toContain('<string>daemon</string>');
    expect(plist).toContain('daemon.out.log');
  });

  it('keeps installer prompts attached to the terminal', async () => {
    const script = await fs.promises.readFile(INSTALL_SCRIPT_PATH, 'utf8');

    expect(script).toContain('exec 3< /dev/tty');
    expect(script).toContain('"$INSTALL_DIR/$BIN_NAME" configure <&3');
    expect(script).toContain('"$INSTALL_DIR/$BIN_NAME" configure --missing-only <&3');
    expect(script).toContain('"$INSTALL_DIR/$BIN_NAME" install-daemon');
    expect(script).toContain('COMPANY_BRAIN_AGENT_SYNC_RELEASE_URL');
    expect(script).toContain('COMPANY_BRAIN_AGENT_SYNC_CONFIGURE_MISSING_ONLY');
    expect(script).toContain('COMPANY_BRAIN_AGENT_SYNC_SKIP_DAEMON');
    expect(script).not.toContain('>&3');
  });
});

function testConfig(dataDir: string, codexSessionDir: string) {
  process.env[CODEX_SESSION_DIR_ENV] = codexSessionDir;
  process.env[CLAUDE_CODE_PROJECTS_DIR_ENV] = path.join(dataDir, 'empty-claude-projects');
  return loadConfig({ dataDir });
}

function enableNangoPush(options: { failFirst?: boolean } = {}): PushedBody[] {
  const bodies: PushedBody[] = [];
  let calls = 0;
  process.env[NANGO_WEBHOOK_URL_ENV] = 'https://nango.test/webhook/env/agent-conversations';
  process.env[NANGO_CONNECTION_ID_ENV] = 'local-agent-sync';
  process.env[NANGO_WEBHOOK_SECRET_ENV] = 'shared-secret';
  globalThis.fetch = mock((_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    bodies.push(JSON.parse(String(init?.body)) as PushedBody);
    if (options.failFirst && calls === 1) {
      return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 500 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true })));
  }) as unknown as typeof fetch;
  return bodies;
}

async function writeCodexTranscript(
  transcriptPath: string,
  options: {
    sessionId: string;
    cwd: string;
    text: string;
    assistantText?: string;
    includeBootstrap?: boolean;
  },
): Promise<void> {
  await fs.promises.mkdir(path.dirname(transcriptPath), { recursive: true });
  const records = [
    {
      timestamp: '2026-06-01T10:00:00.000Z',
      type: 'session_meta',
      payload: {
        id: options.sessionId,
        cwd: options.cwd,
        timestamp: '2026-06-01T10:00:00.000Z',
      },
    },
    ...(options.includeBootstrap
      ? [
          {
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
          },
        ]
      : []),
    {
      timestamp: '2026-06-01T10:00:02.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: options.text }],
      },
    },
    ...(options.assistantText
      ? [
          {
            timestamp: '2026-06-01T10:00:03.000Z',
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: options.assistantText }],
            },
          },
        ]
      : []),
  ];
  await fs.promises.writeFile(
    transcriptPath,
    records.map((record) => JSON.stringify(record)).join('\n'),
  );
}

async function appendCodexAssistantMessage(transcriptPath: string, text: string): Promise<void> {
  await fs.promises.appendFile(
    transcriptPath,
    `\n${JSON.stringify({
      timestamp: '2026-06-01T10:00:04.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text }],
      },
    })}`,
  );
}

async function writeClaudeTranscript(
  transcriptPath: string,
  options: { sessionId: string; cwd: string; text: string; assistantText: string },
): Promise<void> {
  await fs.promises.mkdir(path.dirname(transcriptPath), { recursive: true });
  await fs.promises.writeFile(
    transcriptPath,
    [
      JSON.stringify({
        type: 'user',
        sessionId: options.sessionId,
        timestamp: '2026-06-01T12:30:00.000Z',
        cwd: options.cwd,
        message: { role: 'user', content: options.text },
      }),
      JSON.stringify({
        type: 'assistant',
        sessionId: options.sessionId,
        timestamp: '2026-06-01T12:30:05.000Z',
        cwd: options.cwd,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: options.assistantText }],
        },
      }),
    ].join('\n'),
  );
}

async function makeTempDir(): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  tempDirs.push(tempDir);
  return tempDir;
}
