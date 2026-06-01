import { loadConfig, missingRequiredConfig, type RequiredConfigKey } from './config.js';
import { configureAgentSync } from './configure.js';
import { ensureIdentity } from './identity.js';
import { installLaunchAgent, type LaunchAgentConfig, launchAgentConfig } from './launchd.js';

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
  skipDaemon?: boolean;
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
  const launchAgent = launchAgentConfig(config.dataDir);

  if (missing.length > 0 || options.skipDaemon) {
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
  const installed = await installLaunchAgent(config.dataDir);
  return {
    dataDir: config.dataDir,
    configPath: configured.configPath,
    changed: configured.changed,
    missing,
    launchAgent: installed,
    launchAgentInstalled: true,
  };
}
