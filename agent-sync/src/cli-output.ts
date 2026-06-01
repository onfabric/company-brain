import type { Print } from '@parshjs/core';

import type { InitializeAgentSyncResult } from './init.js';

export function writeOutput(print: Print, value: unknown, json: boolean, text: string): void {
  print.info(json ? JSON.stringify(value, null, 2) : text);
}

export function formatInitResult(result: InitializeAgentSyncResult): string {
  const lines = [`Config: ${result.configPath}`];
  if (result.missing.length > 0) {
    lines.push(`Missing required config: ${result.missing.join(', ')}`);
    lines.push('LaunchAgent was not installed.');
    return lines.join('\n');
  }

  if (result.launchAgentInstalled) {
    lines.push(`Installed ${result.launchAgent.label} at ${result.launchAgent.plistPath}`);
  } else {
    lines.push('Skipped macOS LaunchAgent install.');
  }
  lines.push(`Logs: ${result.launchAgent.logDirectory}`);
  return lines.join('\n');
}
