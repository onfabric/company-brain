import type { AgentSyncConfig } from './config.ts';
import { loadConfig, missingRequiredConfig } from './config.ts';
import { discoverConversations, formatDiscovery } from './discovery.ts';
import { ensureIdentity } from './identity.ts';
import { scanLocalSessions } from './session-scanner.ts';
import { writeStatus } from './status.ts';
import { AgentSyncStore } from './store.ts';
import { nowIso } from './utils.ts';

export async function runDaemon(): Promise<void> {
  while (true) {
    const config = await loadConfig();
    await ensureIdentity(config.dataDir);
    const missing = missingRequiredConfig(config);
    const heartbeat = nowIso();

    if (missing.length > 0) {
      await writeStatus(config.dataDir, {
        state: 'setup-needed',
        updated_at: heartbeat,
        daemon_heartbeat_at: heartbeat,
        missing_config: missing,
      });
      console.error(
        `agent-sync setup needed. Run: company-brain local install agent-sync or company-brain cloud install agent-sync (${missing.join(', ')})`,
      );
      await sleep(config.scanIntervalMs);
      continue;
    }

    try {
      await runDaemonOnce(config, heartbeat);
    } catch (error) {
      const now = nowIso();
      await writeStatus(config.dataDir, {
        state: 'sync-failed',
        updated_at: now,
        daemon_heartbeat_at: heartbeat,
        last_sync_at: now,
        last_sync_result: { error: error instanceof Error ? error.message : String(error) },
      });
      console.error(error);
    }
    await sleep(config.scanIntervalMs);
  }
}

async function runDaemonOnce(config: AgentSyncConfig, heartbeat: string): Promise<void> {
  const discovery = await discoverConversations(config);
  console.log(formatDiscovery(discovery));

  const syncResult = await scanLocalSessions(new AgentSyncStore(config.dataDir), config);
  const now = nowIso();
  await writeStatus(config.dataDir, {
    state: syncResult.failed > 0 ? 'sync-failed' : 'ok',
    updated_at: now,
    daemon_heartbeat_at: heartbeat,
    last_discovery_at: now,
    last_sync_at: now,
    last_sync_result: syncResult,
  });
  console.log(JSON.stringify(syncResult));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
