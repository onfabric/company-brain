import fs from 'node:fs';
import path from 'node:path';

import { captureTranscriptFile } from './capture.ts';
import type { AgentSyncConfig } from './config.ts';
import { missingRequiredConfig } from './config.ts';
import { ensureIdentity } from './identity.ts';
import { pushConversation } from './nango-push.ts';
import { listTranscriptFiles, sourceRoots, type TranscriptFile } from './sources.ts';
import type { AgentSyncStore } from './store.ts';
import type { AgentConversation, AgentSource } from './types.ts';
import { nowIso, readJsonFile, stableHash, writeJsonFile } from './utils.ts';

interface ConversationsState {
  initialized: boolean;
  conversations: Record<string, ConversationStateRecord>;
}

interface ConversationStateRecord {
  source: AgentSource;
  session_id: string;
  transcript_path: string;
  file_mtime_ms: number;
  file_size: number;
  conversation_hash: string;
  last_seen_at: string;
  last_pushed_hash?: string | undefined;
  last_pushed_at?: string | undefined;
  push_status: 'ignored' | 'pushed' | 'failed';
  error?: string | undefined;
}

export interface ScanResult {
  scanned: number;
  ignored: number;
  pushed: number;
  failed: number;
  pending: number;
  tracked: number;
  setup_needed: boolean;
  missing_config?: string[] | undefined;
}

export async function scanLocalSessions(
  store: AgentSyncStore,
  config: AgentSyncConfig,
  options: { all?: boolean } = {},
): Promise<ScanResult> {
  const missing = missingRequiredConfig(config);
  if (missing.length > 0) {
    return {
      scanned: 0,
      ignored: 0,
      pushed: 0,
      failed: 0,
      pending: 0,
      tracked: 0,
      setup_needed: true,
      missing_config: missing,
    };
  }

  const userIdentifier = await ensureIdentity(store.dataDirectory());
  const state = await readConversationsState(store.dataDirectory());
  const firstRun = !state.initialized;
  const pathIndex = indexStateByPath(state);
  const result: ScanResult = {
    scanned: 0,
    ignored: 0,
    pushed: 0,
    failed: 0,
    pending: 0,
    tracked: Object.keys(state.conversations).length,
    setup_needed: false,
  };

  for (const root of sourceRoots(config)) {
    if (!fs.existsSync(root.root)) {
      continue;
    }

    const files = await listTranscriptFiles(root.root);
    for (const file of files) {
      const existingKey = pathIndex.get(file.path);
      const existing = existingKey ? state.conversations[existingKey] : undefined;
      if (!options.all && existing && fileUnchanged(existing, file)) {
        if (existing.push_status === 'failed') {
          await parseAndMaybePush({
            config,
            file,
            firstRun,
            result,
            source: root.source,
            state,
            userIdentifier,
          });
        } else {
          result.ignored += 1;
        }
        continue;
      }

      await parseAndMaybePush({
        config,
        file,
        firstRun,
        result,
        source: root.source,
        state,
        userIdentifier,
      });
    }
  }

  state.initialized = true;
  result.tracked = Object.keys(state.conversations).length;
  result.pending = Object.values(state.conversations).filter(
    (conversation) => conversation.push_status === 'failed',
  ).length;
  await writeConversationsState(store.dataDirectory(), state);
  return result;
}

async function parseAndMaybePush(options: {
  config: AgentSyncConfig;
  file: TranscriptFile;
  firstRun: boolean;
  result: ScanResult;
  source: AgentSource;
  state: ConversationsState;
  userIdentifier: string;
}): Promise<void> {
  options.result.scanned += 1;
  const conversation = await captureTranscriptFile(
    options.source,
    options.file.path,
    options.userIdentifier,
  );
  if (!conversation) {
    return;
  }

  const key = conversation.id;
  const existing = options.state.conversations[key];
  const hash = conversationHash(conversation);
  const now = nowIso();
  const next = nextStateRecord(conversation, options.file, hash, now, existing);

  if (options.firstRun) {
    options.state.conversations[key] = { ...next, push_status: 'ignored' };
    options.result.ignored += 1;
    return;
  }

  if (shouldIgnore(existing, hash)) {
    options.state.conversations[key] = { ...next, push_status: existing.push_status };
    options.result.ignored += 1;
    return;
  }

  const pushResult = await pushConversation(options.config, conversation);
  if (pushResult.status === 'pushed') {
    options.state.conversations[key] = {
      ...next,
      last_pushed_hash: hash,
      last_pushed_at: now,
      push_status: 'pushed',
      error: undefined,
    };
    options.result.pushed += 1;
    return;
  }

  options.state.conversations[key] = {
    ...next,
    push_status: 'failed',
    error: pushResult.error,
  };
  options.result.failed += 1;
}

function shouldIgnore(
  existing: ConversationStateRecord | undefined,
  hash: string,
): existing is ConversationStateRecord {
  if (!existing) {
    return false;
  }

  if (existing.push_status === 'ignored') {
    return existing.conversation_hash === hash;
  }

  return existing.last_pushed_hash === hash;
}

function nextStateRecord(
  conversation: AgentConversation,
  file: TranscriptFile,
  hash: string,
  now: string,
  existing: ConversationStateRecord | undefined,
): ConversationStateRecord {
  return {
    source: conversation.source,
    session_id: conversation.session_id,
    transcript_path: file.path,
    file_mtime_ms: file.mtimeMs,
    file_size: file.size,
    conversation_hash: hash,
    last_seen_at: now,
    last_pushed_hash: existing?.last_pushed_hash,
    last_pushed_at: existing?.last_pushed_at,
    push_status: existing?.push_status ?? 'ignored',
    error: existing?.error,
  };
}

function fileUnchanged(existing: ConversationStateRecord, file: TranscriptFile): boolean {
  return existing.file_mtime_ms === file.mtimeMs && existing.file_size === file.size;
}

function indexStateByPath(state: ConversationsState): Map<string, string> {
  return new Map(
    Object.entries(state.conversations).map(([key, conversation]) => [
      conversation.transcript_path,
      key,
    ]),
  );
}

function conversationHash(conversation: AgentConversation): string {
  return stableHash(conversation);
}

async function readConversationsState(dataDir: string): Promise<ConversationsState> {
  const filePath = conversationsStatePath(dataDir);
  if (!fs.existsSync(filePath)) {
    return { initialized: false, conversations: {} };
  }

  const value = await readJsonFile(filePath);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { initialized: false, conversations: {} };
  }

  const record = value as { initialized?: unknown; conversations?: unknown };
  return {
    initialized: record.initialized === true,
    conversations:
      record.conversations && typeof record.conversations === 'object'
        ? normalizeConversations(record.conversations as Record<string, unknown>)
        : {},
  };
}

async function writeConversationsState(dataDir: string, state: ConversationsState): Promise<void> {
  await writeJsonFile(conversationsStatePath(dataDir), state);
}

function normalizeConversations(
  conversations: Record<string, unknown>,
): Record<string, ConversationStateRecord> {
  return Object.fromEntries(
    Object.entries(conversations)
      .map(([key, value]) => [key, normalizeConversationState(value)] as const)
      .filter((entry): entry is [string, ConversationStateRecord] => Boolean(entry[1])),
  );
}

function normalizeConversationState(value: unknown): ConversationStateRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const source = field(record, 'source');
  const sessionId = field(record, 'session_id');
  const transcriptPath = field(record, 'transcript_path');
  const fileMtimeMs = field(record, 'file_mtime_ms');
  const fileSize = field(record, 'file_size');
  const conversationHashValue = field(record, 'conversation_hash');
  const lastSeenAt = field(record, 'last_seen_at');
  const pushStatus = field(record, 'push_status');
  if (
    !isSource(source) ||
    typeof sessionId !== 'string' ||
    typeof transcriptPath !== 'string' ||
    typeof fileMtimeMs !== 'number' ||
    typeof fileSize !== 'number' ||
    typeof conversationHashValue !== 'string' ||
    typeof lastSeenAt !== 'string' ||
    !isPushStatus(pushStatus)
  ) {
    return undefined;
  }

  return {
    source,
    session_id: sessionId,
    transcript_path: transcriptPath,
    file_mtime_ms: fileMtimeMs,
    file_size: fileSize,
    conversation_hash: conversationHashValue,
    last_seen_at: lastSeenAt,
    last_pushed_hash: optionalString(field(record, 'last_pushed_hash')),
    last_pushed_at: optionalString(field(record, 'last_pushed_at')),
    push_status: pushStatus,
    error: optionalString(field(record, 'error')),
  };
}

function isSource(value: unknown): value is AgentSource {
  return value === 'claude-code' || value === 'codex';
}

function isPushStatus(value: unknown): value is ConversationStateRecord['push_status'] {
  return value === 'ignored' || value === 'pushed' || value === 'failed';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function conversationsStatePath(dataDir: string): string {
  return path.join(dataDir, 'conversations-state.json');
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}
