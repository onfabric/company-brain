import fs from 'node:fs';
import path from 'node:path';

import { readJsonFile, writeJsonFile } from './utils.js';

export interface AgentSyncStatus {
  state: 'ok' | 'setup-needed' | 'sync-failed';
  updated_at: string;
  daemon_heartbeat_at?: string | undefined;
  missing_config?: string[] | undefined;
  last_discovery_at?: string | undefined;
  last_sync_at?: string | undefined;
  last_sync_result?: unknown;
}

export async function readStatus(dataDir: string): Promise<AgentSyncStatus | undefined> {
  const filePath = statusPath(dataDir);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const value = await readJsonFile(filePath);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as AgentSyncStatus;
}

export async function writeStatus(dataDir: string, status: AgentSyncStatus): Promise<void> {
  await writeJsonFile(statusPath(dataDir), status);
}

export function statusPath(dataDir: string): string {
  return path.join(dataDir, 'status.json');
}
