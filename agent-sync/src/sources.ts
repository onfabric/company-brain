import fs from 'node:fs';
import path from 'node:path';

import type { AgentSyncConfig } from './config.js';
import type { AgentSource } from './types.js';

export const JSONL_EXTENSION = '.jsonl';

export interface ConversationSourceRoot {
  source: AgentSource;
  root: string;
}

export interface TranscriptFile {
  path: string;
  mtimeMs: number;
  size: number;
}

export function sourceRoots(config: AgentSyncConfig): ConversationSourceRoot[] {
  return [
    { source: 'codex', root: config.codexSessionDir },
    { source: 'claude-code', root: config.claudeCodeProjectsDir },
  ];
}

export async function listTranscriptFiles(root: string): Promise<TranscriptFile[]> {
  const files = await listTranscriptFilesUnsorted(root);
  return files.sort((left, right) => {
    const byMtime = left.mtimeMs - right.mtimeMs;
    return byMtime === 0 ? left.path.localeCompare(right.path) : byMtime;
  });
}

async function listTranscriptFilesUnsorted(root: string): Promise<TranscriptFile[]> {
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  const files: TranscriptFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTranscriptFilesUnsorted(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(JSONL_EXTENSION)) {
      const stats = await fs.promises.stat(entryPath);
      files.push({ path: entryPath, mtimeMs: stats.mtimeMs, size: stats.size });
    }
  }

  return files;
}
