import fs from 'node:fs';
import path from 'node:path';

import type { AgentSyncConfig } from './config.js';
import { sourceRoots } from './sources.js';
import { parseTranscriptFile } from './transcript-parser.js';
import type { AgentSource } from './types.js';
import { earlierIso, laterIso } from './utils.js';

export interface DirectoryDiscoverySummary {
  source: AgentSource;
  path: string;
  status: 'found' | 'missing' | 'unreadable';
  jsonl_file_count: number;
  session_count: number;
  oldest_started_at?: string | undefined;
  newest_updated_at?: string | undefined;
  error_count: number;
  error_message?: string | undefined;
}

export interface DiscoveryResult {
  directories: DirectoryDiscoverySummary[];
}

interface MutableSummary extends DirectoryDiscoverySummary {
  sessions: Set<string>;
}

export async function discoverConversations(config: AgentSyncConfig): Promise<DiscoveryResult> {
  const directories: DirectoryDiscoverySummary[] = [];

  for (const root of sourceRoots(config)) {
    const rootSummary = await discoverRoot(root.source, root.root);
    directories.push(...rootSummary);
  }

  return { directories };
}

export function formatDiscovery(result: DiscoveryResult): string {
  if (result.directories.length === 0) {
    return 'No conversation directories found.';
  }

  return result.directories
    .map((directory) => {
      const dates =
        directory.oldest_started_at || directory.newest_updated_at
          ? ` ${directory.oldest_started_at ?? 'unknown'}..${directory.newest_updated_at ?? 'unknown'}`
          : '';
      const error = directory.error_message ? ` (${directory.error_message})` : '';
      return `${directory.source} ${directory.status} ${directory.path}: ${directory.session_count} session(s), ${directory.jsonl_file_count} file(s)${dates}${error}`;
    })
    .join('\n');
}

async function discoverRoot(
  source: AgentSource,
  root: string,
): Promise<DirectoryDiscoverySummary[]> {
  if (!fs.existsSync(root)) {
    return [
      {
        source,
        path: root,
        status: 'missing',
        jsonl_file_count: 0,
        session_count: 0,
        error_count: 0,
      },
    ];
  }

  const summaries = new Map<string, MutableSummary>();
  await collectDirectorySummaries(source, root, summaries);
  if (summaries.size === 0) {
    summaries.set(root, ensureSummary(summaries, source, root, 'found'));
  }

  return Array.from(summaries.values())
    .map(({ sessions, ...summary }) => ({
      ...summary,
      session_count: sessions.size,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function collectDirectorySummaries(
  source: AgentSource,
  directory: string,
  summaries: Map<string, MutableSummary>,
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    const summary = ensureSummary(summaries, source, directory, 'unreadable');
    summary.error_count += 1;
    summary.error_message = error instanceof Error ? error.message : String(error);
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectDirectorySummaries(source, entryPath, summaries);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
      continue;
    }

    const summary = ensureSummary(summaries, source, directory, 'found');
    summary.jsonl_file_count += 1;
    try {
      const transcript = await parseTranscriptFile(entryPath, source);
      if (transcript.session_id) {
        summary.sessions.add(transcript.session_id);
      }
      summary.oldest_started_at = earlierIso(summary.oldest_started_at, transcript.started_at);
      summary.newest_updated_at = laterIso(summary.newest_updated_at, transcript.updated_at);
    } catch (error) {
      summary.error_count += 1;
      summary.error_message = error instanceof Error ? error.message : String(error);
    }
  }
}

function ensureSummary(
  summaries: Map<string, MutableSummary>,
  source: AgentSource,
  directory: string,
  status: DirectoryDiscoverySummary['status'],
): MutableSummary {
  const existing = summaries.get(directory);
  if (existing) {
    if (existing.status === 'found') {
      return existing;
    }
    existing.status = status;
    return existing;
  }

  const summary: MutableSummary = {
    source,
    path: directory,
    status,
    jsonl_file_count: 0,
    session_count: 0,
    error_count: 0,
    sessions: new Set(),
  };
  summaries.set(directory, summary);
  return summary;
}
