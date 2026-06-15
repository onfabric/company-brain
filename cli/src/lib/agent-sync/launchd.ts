import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SCAN_INTERVAL_MS, REQUIRED_CONFIG_KEYS, readConfigFile } from './config.ts';

const LABEL = 'dev.company-brain.agent-sync';
const MILLISECONDS_PER_SECOND = 1000;

export interface LaunchAgentConfig {
  label: string;
  plistPath: string;
  logDirectory: string;
  programArguments: string[];
  startIntervalSeconds: number;
}

export function launchAgentConfig(
  dataDir: string,
  scanIntervalMs = DEFAULT_SCAN_INTERVAL_MS,
): LaunchAgentConfig {
  const logDirectory = path.join(dataDir, 'logs');
  return {
    label: LABEL,
    plistPath: path.join(os.homedir(), 'Library/LaunchAgents', `${LABEL}.plist`),
    logDirectory,
    programArguments: syncNowProgramArguments(),
    startIntervalSeconds: intervalSeconds(scanIntervalMs),
  };
}

export function renderLaunchAgentPlist(config: LaunchAgentConfig): string {
  const args = config.programArguments
    .map((argument) => `    <string>${escapeXml(argument)}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(config.label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${config.startIntervalSeconds}</integer>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(config.logDirectory, 'sync-now.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(config.logDirectory, 'sync-now.err.log'))}</string>
</dict>
</plist>
`;
}

export async function installLaunchAgent(dataDir: string): Promise<LaunchAgentConfig> {
  const fileConfig = await readConfigFile(dataDir);
  const missing = REQUIRED_CONFIG_KEYS.filter((key) => !fileConfig[key]);
  if (missing.length > 0) {
    throw new Error(
      `agent-sync setup needed before installing LaunchAgent. Run: company-brain agent-sync install (${missing.join(', ')})`,
    );
  }

  const config = launchAgentConfig(dataDir, fileConfig.scanIntervalMs);
  await fs.promises.mkdir(path.dirname(config.plistPath), { recursive: true });
  await fs.promises.mkdir(config.logDirectory, { recursive: true });
  await fs.promises.writeFile(config.plistPath, renderLaunchAgentPlist(config));
  await runLaunchctl(['bootout', launchTarget(), config.plistPath], { allowFailure: true });
  await runLaunchctl(['bootstrap', launchTarget(), config.plistPath]);
  await runLaunchctl(['kickstart', '-k', `${launchTarget()}/${config.label}`]);
  return config;
}

export async function uninstallLaunchAgent(dataDir: string): Promise<LaunchAgentConfig> {
  const config = launchAgentConfig(dataDir);
  await runLaunchctl(['bootout', launchTarget(), config.plistPath], { allowFailure: true });
  await fs.promises.rm(config.plistPath, { force: true });
  return config;
}

async function runLaunchctl(
  args: string[],
  options: { allowFailure?: boolean } = {},
): Promise<void> {
  const proc = Bun.spawn(['launchctl', ...args], { stderr: 'pipe', stdout: 'pipe' });
  const exitCode = await proc.exited;
  if (exitCode === 0 || options.allowFailure) {
    return;
  }

  const stderr = proc.stderr ? await new Response(proc.stderr).text() : '';
  throw new Error(`launchctl ${args.join(' ')} failed: ${stderr.trim()}`);
}

function launchTarget(): string {
  return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
}

function syncNowProgramArguments(): string[] {
  const scriptPath = process.argv[1];
  if (scriptPath && scriptPath !== process.execPath && scriptPath.endsWith('.ts')) {
    return [process.execPath, path.resolve(scriptPath), 'agent-sync', 'sync-now'];
  }

  const cliPath = fileURLToPath(new URL('../../main.ts', import.meta.url));
  if (fs.existsSync(cliPath)) {
    return [process.execPath, cliPath, 'agent-sync', 'sync-now'];
  }

  return [process.execPath, 'agent-sync', 'sync-now'];
}

function intervalSeconds(scanIntervalMs: number): number {
  return Math.max(1, Math.round(scanIntervalMs / MILLISECONDS_PER_SECOND));
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
