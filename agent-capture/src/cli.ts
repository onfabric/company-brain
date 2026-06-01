#!/usr/bin/env bun
import { getDataDir } from './config.js';
import { runHook } from './hook-runner.js';
import { installHooks } from './install-hooks.js';
import { startServer } from './server.js';
import { scanLocalSessions } from './session-scanner.js';
import { AgentCaptureStore } from './store.js';
import type { AgentSource } from './types.js';

const HELP_TEXT = `Usage:
  company-brain-agent-capture serve
  company-brain-agent-capture hook --source claude-code|codex
  company-brain-agent-capture install-hooks [--claude] [--codex] [--dry-run]
  company-brain-agent-capture scan [--all]
  company-brain-agent-capture push [--all]
`;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'serve') {
    startServer();
    return;
  }

  if (command === 'hook') {
    await runHook(readSource(args));
    return;
  }

  if (command === 'install-hooks') {
    await installHooks({
      claude: args.includes('--claude'),
      codex: args.includes('--codex'),
      dryRun: args.includes('--dry-run'),
    });
    return;
  }

  if (command === 'scan') {
    const result = await scanLocalSessions(new AgentCaptureStore(getDataDir()), {
      all: args.includes('--all'),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'push') {
    const result = await scanLocalSessions(new AgentCaptureStore(getDataDir()), {
      all: args.includes('--all'),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(HELP_TEXT);
}

function readSource(args: readonly string[]): AgentSource {
  const index = args.indexOf('--source');
  const value = index >= 0 ? args[index + 1] : undefined;
  if (value === 'claude-code' || value === 'codex') {
    return value;
  }

  throw new Error('Expected --source claude-code|codex');
}

await main();
