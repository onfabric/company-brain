import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import {
  type AgentSyncConfigFile,
  configPath,
  loadConfig,
  missingRequiredConfig,
  REQUIRED_CONFIG_KEYS,
  type RequiredConfigKey,
  readConfigFile,
  requiredConfigLabel,
  writeConfigFile,
} from './config.js';

export interface ConfigureResult {
  configPath: string;
  changed: boolean;
  missing: RequiredConfigKey[];
}

export async function configureAgentSync(options: {
  dataDir?: string;
  missingOnly?: boolean;
  persistResolvedRequiredConfig?: boolean;
}): Promise<ConfigureResult> {
  const dataDir = options.dataDir;
  const current = await loadConfig(dataDir ? { dataDir } : {});
  const fileConfig = await readConfigFile(current.dataDir);
  const missing = missingRequiredConfig(current);
  const next: AgentSyncConfigFile = { ...fileConfig };
  let changed = false;

  if (options.persistResolvedRequiredConfig) {
    for (const key of REQUIRED_CONFIG_KEYS) {
      const resolved = stringValue(current[key]);
      if (resolved && next[key] !== resolved) {
        next[key] = resolved;
        changed = true;
      }
    }
  }

  const prompts = options.missingOnly ? missing : REQUIRED_CONFIG_KEYS;
  if (prompts.length === 0) {
    if (changed) {
      await writeConfigFile(next, current.dataDir);
    }
    const updated = await loadConfig({ dataDir: current.dataDir });
    return { configPath: current.configPath, changed, missing: missingRequiredConfig(updated) };
  }

  const rl = createInterface({ input, output });
  try {
    for (const key of prompts) {
      const existing = stringValue(next[key]) ?? stringValue(current[key]);
      const suffix = existing ? ` [${existing}]` : '';
      const value = await rl.question(`${requiredConfigLabel(key)}${suffix}: `);
      const trimmed = value.trim();
      if (trimmed) {
        next[key] = trimmed;
      } else if (existing) {
        next[key] = existing;
      }
    }
    await writeConfigFile(next, current.dataDir);
  } finally {
    rl.close();
  }

  const updated = await loadConfig({ dataDir: current.dataDir });
  return {
    configPath: configPath(current.dataDir),
    changed: true,
    missing: missingRequiredConfig(updated),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
