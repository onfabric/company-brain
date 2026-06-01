#!/usr/bin/env bun
import { getDataDir, loadConfig, missingRequiredConfig } from './config.js';
import { configureAgentSync } from './configure.js';
import { runDaemon } from './daemon.js';
import { discoverConversations, formatDiscovery } from './discovery.js';
import { ensureIdentity, readIdentity } from './identity.js';
import { installLaunchAgent, uninstallLaunchAgent } from './launchd.js';
import { scanLocalSessions } from './session-scanner.js';
import { readStatus, writeStatus } from './status.js';
import { AgentSyncStore } from './store.js';
import { nowIso } from './utils.js';

const HELP_TEXT = `Usage:
  company-brain-agent-sync configure [--missing-only]
  company-brain-agent-sync daemon
  company-brain-agent-sync discover [--json]
  company-brain-agent-sync sync-now [--all] [--json]
  company-brain-agent-sync status [--json]
  company-brain-agent-sync install-daemon
  company-brain-agent-sync uninstall-daemon
`;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'configure') {
    const result = await configureAgentSync({ missingOnly: args.includes('--missing-only') });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'daemon') {
    await runDaemon();
    return;
  }

  if (command === 'discover') {
    const config = await loadConfig();
    const result = await discoverConversations(config);
    await writeStatus(config.dataDir, {
      state: missingRequiredConfig(config).length > 0 ? 'setup-needed' : 'ok',
      updated_at: nowIso(),
      last_discovery_at: nowIso(),
      missing_config: missingRequiredConfig(config),
    });
    writeOutput(result, args.includes('--json'), formatDiscovery(result));
    return;
  }

  if (command === 'sync-now') {
    const config = await loadConfig();
    const result = await scanLocalSessions(new AgentSyncStore(config.dataDir), config, {
      all: args.includes('--all'),
    });
    await writeStatus(config.dataDir, {
      state: result.setup_needed ? 'setup-needed' : result.failed > 0 ? 'sync-failed' : 'ok',
      updated_at: nowIso(),
      last_sync_at: nowIso(),
      last_sync_result: result,
      missing_config: result.missing_config,
    });
    writeOutput(result, args.includes('--json'), JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'status') {
    const config = await loadConfig();
    const identity = await readIdentity(config.dataDir);
    const status = await readStatus(config.dataDir);
    const value = {
      dataDir: config.dataDir,
      configPath: config.configPath,
      user_identifier: identity,
      missing_config: missingRequiredConfig(config),
      status,
    };
    writeOutput(value, args.includes('--json'), JSON.stringify(value, null, 2));
    return;
  }

  if (command === 'install-daemon') {
    const config = await loadConfig();
    await ensureIdentity(config.dataDir);
    const result = await installLaunchAgent(config.dataDir);
    console.log(`Installed ${result.label} at ${result.plistPath}`);
    return;
  }

  if (command === 'uninstall-daemon') {
    const result = await uninstallLaunchAgent(getDataDir());
    console.log(`Uninstalled ${result.label} from ${result.plistPath}`);
    return;
  }

  console.log(HELP_TEXT);
}

function writeOutput(value: unknown, json: boolean, text: string): void {
  console.log(json ? JSON.stringify(value, null, 2) : text);
}

await main();
