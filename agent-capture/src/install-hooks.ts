import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AgentSource } from './types.js';
import { readJsonFile, writeJsonFile } from './utils.js';

const CLAUDE_EVENTS = ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd'];
const CODEX_EVENTS = ['SessionStart', 'UserPromptSubmit', 'Stop'];
const HOOK_TIMEOUT_SECONDS = 5;

interface InstallOptions {
  claude?: boolean;
  codex?: boolean;
  dryRun?: boolean;
}

export async function installHooks(options: InstallOptions): Promise<void> {
  const installTargets = resolveInstallTargets(options);
  const commandBySource = {
    'claude-code': hookCommand('claude-code'),
    codex: hookCommand('codex'),
  };

  if (installTargets.claude) {
    await installHookConfig({
      filePath: path.join(os.homedir(), '.claude/settings.json'),
      events: CLAUDE_EVENTS,
      command: commandBySource['claude-code'],
      dryRun: options.dryRun ?? false,
    });
  }

  if (installTargets.codex) {
    await installHookConfig({
      filePath: path.join(os.homedir(), '.codex/hooks.json'),
      events: CODEX_EVENTS,
      command: commandBySource.codex,
      dryRun: options.dryRun ?? false,
    });
  }
}

export function resolveInstallTargets(options: InstallOptions): {
  claude: boolean;
  codex: boolean;
} {
  const hasExplicitTarget = options.claude === true || options.codex === true;
  return {
    claude: options.claude === true || !hasExplicitTarget,
    codex: options.codex === true || !hasExplicitTarget,
  };
}

async function installHookConfig(options: {
  filePath: string;
  events: readonly string[];
  command: string;
  dryRun?: boolean;
}): Promise<void> {
  const config = await readConfig(options.filePath);
  const hooks = ensureRecord(config, 'hooks');

  for (const event of options.events) {
    const groups = ensureArray(hooks, event);
    if (hasCommand(groups, options.command)) {
      continue;
    }
    groups.push({
      hooks: [{ type: 'command', command: options.command, timeout: HOOK_TIMEOUT_SECONDS }],
    });
  }

  if (options.dryRun) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  await writeJsonFile(options.filePath, config);
  console.log(`Installed agent capture hooks in ${options.filePath}`);
}

async function readConfig(filePath: string): Promise<Record<string, unknown>> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const value = await readJsonFile(filePath);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

function ensureArray(parent: Record<string, unknown>, key: string): Array<Record<string, unknown>> {
  const value = parent[key];
  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }

  const next: Array<Record<string, unknown>> = [];
  parent[key] = next;
  return next;
}

function hasCommand(groups: Array<Record<string, unknown>>, command: string): boolean {
  return groups.some((group) => {
    const hooks = field(group, 'hooks');
    return (
      Array.isArray(hooks) &&
      hooks.some((hook) => {
        return (
          hook &&
          typeof hook === 'object' &&
          !Array.isArray(hook) &&
          field(hook as Record<string, unknown>, 'command') === command
        );
      })
    );
  });
}

function hookCommand(source: AgentSource): string {
  const cliPath = fileURLToPath(new URL('./cli.ts', import.meta.url));
  return `${shellQuote(process.execPath)} ${shellQuote(cliPath)} hook --source ${source}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}
