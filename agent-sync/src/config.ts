import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readJsonFile, writeJsonFile } from './utils.js';

const DEFAULT_DATA_DIR = '.company-brain/agent-sync';
const DEFAULT_SCAN_INTERVAL_MS = 1_800_000;
const DEFAULT_NANGO_PUSH_TIMEOUT_MS = 5_000;

export interface AgentSyncConfigFile {
  nangoWebhookUrl?: string | undefined;
  nangoConnectionId?: string | undefined;
  nangoWebhookSecret?: string | undefined;
  scanIntervalMs?: number | undefined;
  nangoPushTimeoutMs?: number | undefined;
  codexSessionDir?: string | undefined;
  claudeCodeProjectsDir?: string | undefined;
}

export interface AgentSyncConfig {
  dataDir: string;
  configPath: string;
  nangoWebhookUrl?: string | undefined;
  nangoConnectionId?: string | undefined;
  nangoWebhookSecret?: string | undefined;
  scanIntervalMs: number;
  nangoPushTimeoutMs: number;
  codexSessionDir: string;
  claudeCodeProjectsDir: string;
}

export type RequiredConfigKey = 'nangoWebhookUrl' | 'nangoConnectionId' | 'nangoWebhookSecret';

export function getDataDir(): string {
  return path.resolve(
    env('COMPANY_BRAIN_AGENT_SYNC_DIR') ??
      env('COMPANY_BRAIN_AGENT_CAPTURE_DIR') ??
      path.join(os.homedir(), DEFAULT_DATA_DIR),
  );
}

export function configPath(dataDir = getDataDir()): string {
  return path.join(dataDir, 'config.json');
}

export async function loadConfig(options: { dataDir?: string } = {}): Promise<AgentSyncConfig> {
  const dataDir = options.dataDir ?? getDataDir();
  const fileConfig = await readConfigFile(dataDir);

  return {
    dataDir,
    configPath: configPath(dataDir),
    nangoWebhookUrl: firstNonEmpty(
      env('COMPANY_BRAIN_NANGO_WEBHOOK_URL'),
      fileConfig.nangoWebhookUrl,
    ),
    nangoConnectionId: firstNonEmpty(
      env('COMPANY_BRAIN_NANGO_CONNECTION_ID'),
      fileConfig.nangoConnectionId,
    ),
    nangoWebhookSecret: firstNonEmpty(
      env('COMPANY_BRAIN_NANGO_WEBHOOK_SECRET'),
      fileConfig.nangoWebhookSecret,
    ),
    scanIntervalMs:
      envNumber('COMPANY_BRAIN_AGENT_SYNC_SCAN_INTERVAL_MS') ??
      envNumber('COMPANY_BRAIN_AGENT_CAPTURE_SCAN_INTERVAL_MS') ??
      positiveNumber(fileConfig.scanIntervalMs) ??
      DEFAULT_SCAN_INTERVAL_MS,
    nangoPushTimeoutMs:
      envNumber('COMPANY_BRAIN_NANGO_PUSH_TIMEOUT_MS') ??
      positiveNumber(fileConfig.nangoPushTimeoutMs) ??
      DEFAULT_NANGO_PUSH_TIMEOUT_MS,
    codexSessionDir: path.resolve(
      firstNonEmpty(env('COMPANY_BRAIN_CODEX_SESSION_DIR'), fileConfig.codexSessionDir) ??
        path.join(os.homedir(), '.codex/sessions'),
    ),
    claudeCodeProjectsDir: path.resolve(
      firstNonEmpty(
        env('COMPANY_BRAIN_CLAUDE_CODE_PROJECTS_DIR'),
        fileConfig.claudeCodeProjectsDir,
      ) ?? path.join(os.homedir(), '.claude/projects'),
    ),
  };
}

export async function readConfigFile(dataDir = getDataDir()): Promise<AgentSyncConfigFile> {
  const filePath = configPath(dataDir);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const value = await readJsonFile(filePath);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    nangoWebhookUrl: stringField(record, 'nangoWebhookUrl'),
    nangoConnectionId: stringField(record, 'nangoConnectionId'),
    nangoWebhookSecret: stringField(record, 'nangoWebhookSecret'),
    scanIntervalMs: positiveNumber(field(record, 'scanIntervalMs')),
    nangoPushTimeoutMs: positiveNumber(field(record, 'nangoPushTimeoutMs')),
    codexSessionDir: stringField(record, 'codexSessionDir'),
    claudeCodeProjectsDir: stringField(record, 'claudeCodeProjectsDir'),
  };
}

export async function writeConfigFile(
  config: AgentSyncConfigFile,
  dataDir = getDataDir(),
): Promise<void> {
  await writeJsonFile(configPath(dataDir), removeUndefined(config));
}

export function missingRequiredConfig(config: AgentSyncConfig): RequiredConfigKey[] {
  const missing: RequiredConfigKey[] = [];
  if (!config.nangoWebhookUrl) {
    missing.push('nangoWebhookUrl');
  }
  if (!config.nangoConnectionId) {
    missing.push('nangoConnectionId');
  }
  if (!config.nangoWebhookSecret) {
    missing.push('nangoWebhookSecret');
  }
  return missing;
}

export function requiredConfigLabel(key: RequiredConfigKey): string {
  const labels: Record<RequiredConfigKey, string> = {
    nangoWebhookUrl: 'Nango webhook URL',
    nangoConnectionId: 'Nango connection ID',
    nangoWebhookSecret: 'Nango webhook password',
  };
  return labels[key];
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => nonEmpty(value));
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function envNumber(key: string): number | undefined {
  return positiveNumber(env(key));
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = field(record, key);
  return typeof value === 'string' ? nonEmpty(value) : undefined;
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function env(key: string): string | undefined {
  return process.env[key];
}

function removeUndefined(value: AgentSyncConfigFile): AgentSyncConfigFile {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as AgentSyncConfigFile;
}
