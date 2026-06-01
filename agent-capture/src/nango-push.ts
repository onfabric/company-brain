import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  getNangoConnectionId,
  getNangoPushTimeoutMs,
  getNangoWebhookSecret,
  getNangoWebhookUrl,
  isDebugEnabled,
} from './config.js';
import type { AgentCaptureStore } from './store.js';
import type { AgentConversation } from './types.js';
import { nowIso, readJsonFile, writeJsonFile } from './utils.js';

export const NANGO_WEBHOOK_TYPE = 'agent.conversation.upsert';

interface PushState {
  records: Record<string, PushedRecordState>;
}

interface PushedRecordState {
  hash: string;
  pushed_at: string;
}

interface PushConfig {
  webhookUrl: string;
  connectionId: string;
  secret?: string | undefined;
  timeoutMs: number;
}

export interface PushResult {
  status: 'disabled' | 'failed' | 'pushed' | 'skipped';
  pushed: number;
  skipped: number;
  error?: string | undefined;
}

export function pushConversationIfConfigured(
  store: AgentCaptureStore,
  conversation: AgentConversation,
  options: { force?: boolean } = {},
): Promise<PushResult> {
  return pushConversationsIfConfigured(store, [conversation], options);
}

async function pushConversationsIfConfigured(
  store: AgentCaptureStore,
  conversations: readonly AgentConversation[],
  options: { force?: boolean },
): Promise<PushResult> {
  let skipped = 0;
  try {
    const config = readPushConfig();
    if (!config) {
      return { status: 'disabled', pushed: 0, skipped: 0 };
    }

    const state = await readPushState(store.dataDirectory());
    const changed = conversations.filter((conversation) => {
      const hash = conversationHash(conversation);
      return options.force || state.records[conversation.id]?.hash !== hash;
    });
    skipped = conversations.length - changed.length;
    if (changed.length === 0) {
      return { status: 'skipped', pushed: 0, skipped };
    }

    await postConversations(config, changed);
    const pushedAt = nowIso();
    for (const conversation of changed) {
      state.records[conversation.id] = {
        hash: conversationHash(conversation),
        pushed_at: pushedAt,
      };
    }
    await writePushState(store.dataDirectory(), state);
    return { status: 'pushed', pushed: changed.length, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isDebugEnabled()) {
      console.error(error);
    }
    return { status: 'failed', pushed: 0, skipped, error: message };
  }
}

function readPushConfig(): PushConfig | undefined {
  const webhookUrl = getNangoWebhookUrl();
  if (!webhookUrl) {
    return undefined;
  }

  const connectionId = getNangoConnectionId();
  if (!connectionId) {
    throw new Error('COMPANY_BRAIN_NANGO_CONNECTION_ID is required when Nango push is enabled');
  }

  return {
    webhookUrl,
    connectionId,
    secret: getNangoWebhookSecret(),
    timeoutMs: getNangoPushTimeoutMs(),
  };
}

async function postConversations(
  config: PushConfig,
  conversations: readonly AgentConversation[],
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: NANGO_WEBHOOK_TYPE,
        connectionId: config.connectionId,
        sentAt: nowIso(),
        records: conversations,
        ...(config.secret ? { secret: config.secret } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Nango webhook returned ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function readPushState(dataDir: string): Promise<PushState> {
  const filePath = pushStatePath(dataDir);
  if (!fs.existsSync(filePath)) {
    return { records: {} };
  }

  const value = await readJsonFile(filePath);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { records: {} };
  }

  const records = (value as { records?: unknown }).records;
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    return { records: {} };
  }

  return { records: normalizeRecords(records as Record<string, unknown>) };
}

async function writePushState(dataDir: string, state: PushState): Promise<void> {
  await writeJsonFile(pushStatePath(dataDir), state);
}

function normalizeRecords(records: Record<string, unknown>): PushState['records'] {
  return Object.fromEntries(
    Object.entries(records)
      .map(([id, value]) => [id, normalizeRecordState(value)] as const)
      .filter((entry): entry is [string, PushedRecordState] => Boolean(entry[1])),
  );
}

function normalizeRecordState(value: unknown): PushedRecordState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as { hash?: unknown; pushed_at?: unknown };
  const hash = record.hash;
  const pushedAt = record.pushed_at;
  if (typeof hash !== 'string' || typeof pushedAt !== 'string') {
    return undefined;
  }

  return { hash, pushed_at: pushedAt };
}

function conversationHash(conversation: AgentConversation): string {
  return createHash('sha256').update(stableStringify(conversation)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter((entry) => entry[1] !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

function pushStatePath(dataDir: string): string {
  return path.join(dataDir, 'push-state.json');
}
