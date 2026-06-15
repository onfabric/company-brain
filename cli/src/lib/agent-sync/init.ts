import { loadConfig, missingRequiredConfig, type RequiredConfigKey } from './config.ts';
import { configureAgentSync } from './configure.ts';
import { ensureIdentity } from './identity.ts';
import {
  type AgentSyncTarget,
  installLaunchAgent,
  type LaunchAgentConfig,
  launchAgentConfig,
} from './launchd.ts';

export interface InitializeAgentSyncResult {
  dataDir: string;
  configPath: string;
  changed: boolean;
  missing: RequiredConfigKey[];
  launchAgent: LaunchAgentConfig;
  launchAgentInstalled: boolean;
}

export async function initializeAgentSync(options: {
  dataDir?: string;
  missingOnly?: boolean;
  skipLaunchAgent?: boolean;
  target?: AgentSyncTarget;
}): Promise<InitializeAgentSyncResult> {
  const configureOptions: {
    dataDir?: string;
    missingOnly?: boolean;
    persistResolvedRequiredConfig: boolean;
  } = {
    persistResolvedRequiredConfig: true,
  };
  if (options.dataDir) {
    configureOptions.dataDir = options.dataDir;
  }
  if (options.missingOnly !== undefined) {
    configureOptions.missingOnly = options.missingOnly;
  }

  const configured = await configureAgentSync(configureOptions);
  const config = await loadConfig(options.dataDir ? { dataDir: options.dataDir } : {});
  const missing = missingRequiredConfig(config);
  const target = options.target ?? 'local';
  const launchAgent = launchAgentConfig(config.dataDir, target);

  if (missing.length > 0 || options.skipLaunchAgent) {
    return {
      dataDir: config.dataDir,
      configPath: configured.configPath,
      changed: configured.changed,
      missing,
      launchAgent,
      launchAgentInstalled: false,
    };
  }

  await ensureIdentity(config.dataDir);
  const installed = await installLaunchAgent(config.dataDir, target);
  return {
    dataDir: config.dataDir,
    configPath: configured.configPath,
    changed: configured.changed,
    missing,
    launchAgent: installed,
    launchAgentInstalled: true,
  };
}
