import fs from 'node:fs';
import os from 'node:os';
import { log, note } from '@clack/prompts';
import { requireAwsConfig } from '../aws-config.ts';
import { httpsIssues } from '../aws-dns.ts';
import { ensureCloudNangoApiKey } from '../nango-api-key.ts';
import { loadConfig, readConfigFile, writeConfigFile } from './config.ts';
import { ensureIdentity, readIdentity } from './identity.ts';
import { installLaunchAgent, launchAgentConfig, uninstallLaunchAgent } from './launchd.ts';
import { ensureAgentConversationsNango } from './nango.ts';
import { type ScanResult, scanLocalSessions } from './session-scanner.ts';
import { readStatus, writeStatus } from './status.ts';
import { AgentSyncStore } from './store.ts';
import { nowIso } from './utils.ts';

type Printer = {
  success: (message: string) => void;
  warn: (message: string) => void;
};

export type AgentSyncInstallResult = {
  configPath: string;
  launchAgentPath: string;
  logDirectory: string;
  webhookUrl: string;
};

export type AgentSyncStatusResult = {
  dataDir: string;
  configPath: string;
  user_identifier?: string | undefined;
  missing_config: string[];
  launchAgent: {
    label: string;
    plistPath: string;
    installed: boolean;
    loaded: boolean;
  };
  status: Awaited<ReturnType<typeof readStatus>>;
};

export async function installAgentSync(options: {
  nonInteractive: boolean;
  verbose: boolean;
  print: Printer;
}): Promise<AgentSyncInstallResult> {
  log.step('Checking hosted Company Brain readiness...');
  const resolved = await resolveCloudTarget(options.nonInteractive, options.print);

  log.step('Installing agent conversation integration and sync in Nango...');
  const nango = await ensureAgentConversationsNango({
    nangoUrl: resolved.nangoUrl,
    nangoSecretKey: resolved.nangoSecretKey,
    webhookSecret: resolved.webhookSecret,
    verbose: options.verbose,
  });

  log.step('Writing local agent sync configuration...');
  const existing = await readConfigFile();
  const config = await loadConfig();
  await writeConfigFile({
    ...existing,
    nangoWebhookUrl: nango.webhookUrl,
    nangoConnectionId: nango.connectionId,
    nangoWebhookSecret: resolved.webhookSecret,
  });
  await ensureIdentity(config.dataDir);

  log.step('Installing the macOS LaunchAgent schedule...');
  const launchAgent = await installLaunchAgent(config.dataDir);
  options.print.success('Agent sync LaunchAgent is installed.');

  return {
    configPath: config.configPath,
    launchAgentPath: launchAgent.plistPath,
    logDirectory: launchAgent.logDirectory,
    webhookUrl: nango.webhookUrl,
  };
}

export async function uninstallAgentSync(): Promise<{ plistPath: string }> {
  const config = await loadConfig();
  const launchAgent = await uninstallLaunchAgent(config.dataDir);
  return { plistPath: launchAgent.plistPath };
}

export async function syncAgentSyncNow(): Promise<ScanResult> {
  const config = await loadConfig();
  const result = await scanLocalSessions(new AgentSyncStore(config.dataDir), config);
  const updatedAt = nowIso();
  await writeStatus(config.dataDir, {
    state: result.setup_needed ? 'setup-needed' : result.failed > 0 ? 'sync-failed' : 'ok',
    updated_at: updatedAt,
    last_sync_at: updatedAt,
    last_sync_result: result,
    missing_config: result.missing_config,
  });
  return result;
}

export async function agentSyncStatus(): Promise<AgentSyncStatusResult> {
  const config = await loadConfig();
  const launchAgent = launchAgentConfig(config.dataDir);
  return {
    dataDir: config.dataDir,
    configPath: config.configPath,
    user_identifier: await readIdentity(config.dataDir),
    missing_config: [
      ...(!config.nangoWebhookUrl ? ['nangoWebhookUrl'] : []),
      ...(!config.nangoConnectionId ? ['nangoConnectionId'] : []),
      ...(!config.nangoWebhookSecret ? ['nangoWebhookSecret'] : []),
    ],
    launchAgent: {
      label: launchAgent.label,
      plistPath: launchAgent.plistPath,
      installed: fs.existsSync(launchAgent.plistPath),
      loaded: await launchAgentIsLoaded(launchAgent.label),
    },
    status: await readStatus(config.dataDir),
  };
}

export function formatAgentSyncStatus(status: AgentSyncStatusResult): string {
  return [
    `Config: ${status.configPath}`,
    `LaunchAgent: ${status.launchAgent.installed ? 'installed' : 'not installed'}, ${status.launchAgent.loaded ? 'loaded' : 'not loaded'}`,
    `State: ${status.status?.state ?? 'unknown'}`,
    `Last sync: ${status.status?.last_sync_at ?? 'never'}`,
    `Missing config: ${status.missing_config.length > 0 ? status.missing_config.join(', ') : 'none'}`,
  ].join('\n');
}

async function resolveCloudTarget(
  nonInteractive: boolean,
  print: Printer,
): Promise<{ nangoUrl: string; nangoSecretKey: string; webhookSecret: string }> {
  let config = await requireAwsConfig();
  if (!config.outputs || !config.appDeployedAt) {
    throw new Error('Cloud Company Brain is not deployed. Run: company-brain setup');
  }

  const issues = await httpsIssues(config);
  if (issues.length > 0) {
    note(issues.join('\n'), 'Cloud HTTPS check');
    throw new Error('Cloud Company Brain is not reachable. Run: company-brain resume');
  }

  config = await ensureCloudNangoApiKey(config, nonInteractive, print);
  const nangoSecretKey = requireValue(config.secrets.nangoSecretKey, 'Cloud Nango dev API key');
  return {
    nangoUrl: `https://${config.nangoHostname}`,
    nangoSecretKey,
    webhookSecret: config.agentSyncWebhookSecret,
  };
}

async function launchAgentIsLoaded(label: string): Promise<boolean> {
  const child = Bun.spawn(['launchctl', 'print', `${launchTarget()}/${label}`], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return (await child.exited) === 0;
}

function launchTarget(): string {
  return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }

  return value;
}
