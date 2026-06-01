import fs from 'node:fs';
import path from 'node:path';

import { captureTranscriptFile } from './capture.js';
import { getClaudeCodeProjectsDir, getCodexSessionDir } from './config.js';
import { pushConversationIfConfigured } from './nango-push.js';
import type { AgentCaptureStore } from './store.js';
import type { AgentSource } from './types.js';
import { readJsonFile, writeJsonFile } from './utils.js';

const JSONL_EXTENSION = '.jsonl';
const INITIAL_MTIME_MS = 0;

interface ScanState {
  lastCodexMtimeMs: number;
  lastClaudeCodeMtimeMs: number;
}

interface ScanResult {
  scanned: number;
  captured: number;
}

interface TranscriptFile {
  path: string;
  mtimeMs: number;
}

export async function scanLocalSessions(
  store: AgentCaptureStore,
  options: { all?: boolean } = {},
): Promise<ScanResult> {
  const state = await readScanState(store.dataDirectory());
  const sinceCodexMtimeMs = options.all ? INITIAL_MTIME_MS : state.lastCodexMtimeMs;
  const sinceClaudeCodeMtimeMs = options.all ? INITIAL_MTIME_MS : state.lastClaudeCodeMtimeMs;
  const codexResult = await scanTranscriptFiles(
    store,
    'codex',
    getCodexSessionDir(),
    sinceCodexMtimeMs,
  );
  const claudeCodeResult = await scanTranscriptFiles(
    store,
    'claude-code',
    getClaudeCodeProjectsDir(),
    sinceClaudeCodeMtimeMs,
  );
  const nextState = {
    lastCodexMtimeMs: Math.max(state.lastCodexMtimeMs, codexResult.latestMtimeMs),
    lastClaudeCodeMtimeMs: Math.max(state.lastClaudeCodeMtimeMs, claudeCodeResult.latestMtimeMs),
  };
  if (
    nextState.lastCodexMtimeMs > state.lastCodexMtimeMs ||
    nextState.lastClaudeCodeMtimeMs > state.lastClaudeCodeMtimeMs
  ) {
    await writeScanState(store.dataDirectory(), nextState);
  }

  return {
    scanned: codexResult.scanned + claudeCodeResult.scanned,
    captured: codexResult.captured + claudeCodeResult.captured,
  };
}

async function scanTranscriptFiles(
  store: AgentCaptureStore,
  source: AgentSource,
  root: string,
  sinceMtimeMs: number,
): Promise<ScanResult & { latestMtimeMs: number }> {
  const files = await listJsonlFiles(root);
  let scanned = 0;
  let captured = 0;
  let latestMtimeMs = sinceMtimeMs;

  for (const file of files) {
    if (file.mtimeMs <= sinceMtimeMs) {
      continue;
    }

    scanned += 1;
    const conversation = await captureTranscriptFile(source, file.path);
    if (conversation) {
      const pushResult = await pushConversationIfConfigured(store, conversation);
      if (pushResult.status === 'failed') {
        break;
      }
      captured += 1;
    }
    latestMtimeMs = Math.max(latestMtimeMs, file.mtimeMs);
  }

  return { scanned, captured, latestMtimeMs };
}

async function listJsonlFiles(root: string): Promise<TranscriptFile[]> {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  const files: TranscriptFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonlFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(JSONL_EXTENSION)) {
      const stats = await fs.promises.stat(entryPath);
      files.push({ path: entryPath, mtimeMs: stats.mtimeMs });
    }
  }

  return files.sort((left, right) => {
    const byMtime = left.mtimeMs - right.mtimeMs;
    return byMtime === 0 ? left.path.localeCompare(right.path) : byMtime;
  });
}

async function readScanState(dataDir: string): Promise<ScanState> {
  const statePath = scanStatePath(dataDir);
  if (!fs.existsSync(statePath)) {
    return { lastCodexMtimeMs: INITIAL_MTIME_MS, lastClaudeCodeMtimeMs: INITIAL_MTIME_MS };
  }

  const value = await readJsonFile(statePath);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { lastCodexMtimeMs: INITIAL_MTIME_MS, lastClaudeCodeMtimeMs: INITIAL_MTIME_MS };
  }

  const lastCodexMtimeMs = field(value as Record<string, unknown>, 'lastCodexMtimeMs');
  const lastClaudeCodeMtimeMs = field(value as Record<string, unknown>, 'lastClaudeCodeMtimeMs');
  return {
    lastCodexMtimeMs:
      typeof lastCodexMtimeMs === 'number' && Number.isFinite(lastCodexMtimeMs)
        ? lastCodexMtimeMs
        : INITIAL_MTIME_MS,
    lastClaudeCodeMtimeMs:
      typeof lastClaudeCodeMtimeMs === 'number' && Number.isFinite(lastClaudeCodeMtimeMs)
        ? lastClaudeCodeMtimeMs
        : INITIAL_MTIME_MS,
  };
}

async function writeScanState(dataDir: string, state: ScanState): Promise<void> {
  await writeJsonFile(scanStatePath(dataDir), state);
}

function scanStatePath(dataDir: string): string {
  return path.join(dataDir, 'scan-state.json');
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}
