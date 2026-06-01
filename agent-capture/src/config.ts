import os from 'node:os';
import path from 'node:path';

const DEFAULT_PORT = 6174;
const DEFAULT_DATA_DIR = '.company-brain/agent-capture';
const DEFAULT_SCAN_INTERVAL_MS = 15_000;
const DEFAULT_NANGO_PUSH_TIMEOUT_MS = 5_000;

export function getDataDir(): string {
  return path.resolve(
    env('COMPANY_BRAIN_AGENT_CAPTURE_DIR') ?? path.join(os.homedir(), DEFAULT_DATA_DIR),
  );
}

export function getPort(): number {
  const rawPort = env('COMPANY_BRAIN_AGENT_CAPTURE_PORT');
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(rawPort, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
}

export function getCollectorUrl(): string {
  return env('COMPANY_BRAIN_AGENT_CAPTURE_URL') ?? `http://127.0.0.1:${getPort()}`;
}

export function getToken(): string | undefined {
  const token = env('COMPANY_BRAIN_AGENT_CAPTURE_TOKEN');
  return token && token.trim().length > 0 ? token : undefined;
}

export function getUserIdentifier(): string | undefined {
  return (
    firstNonEmpty(
      env('COMPANY_BRAIN_USER_IDENTIFIER'),
      env('COMPANY_BRAIN_USER'),
      env('USER'),
      env('USERNAME'),
    ) ?? undefined
  );
}

export function isDebugEnabled(): boolean {
  return env('COMPANY_BRAIN_AGENT_CAPTURE_DEBUG') === '1';
}

export function isEventLogEnabled(): boolean {
  return env('COMPANY_BRAIN_AGENT_CAPTURE_LOG_EVENTS') === '1';
}

export function isLocalSessionScanEnabled(): boolean {
  return env('COMPANY_BRAIN_AGENT_CAPTURE_SCAN_LOCAL_SESSIONS') !== '0';
}

export function getScanIntervalMs(): number {
  const rawInterval = env('COMPANY_BRAIN_AGENT_CAPTURE_SCAN_INTERVAL_MS');
  if (!rawInterval) {
    return DEFAULT_SCAN_INTERVAL_MS;
  }

  const parsed = Number.parseInt(rawInterval, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SCAN_INTERVAL_MS;
}

export function getCodexSessionDir(): string {
  return env('COMPANY_BRAIN_CODEX_SESSION_DIR') ?? path.join(os.homedir(), '.codex/sessions');
}

export function getClaudeCodeProjectsDir(): string {
  return (
    env('COMPANY_BRAIN_CLAUDE_CODE_PROJECTS_DIR') ?? path.join(os.homedir(), '.claude/projects')
  );
}

export function getNangoWebhookUrl(): string | undefined {
  return nonEmpty(env('COMPANY_BRAIN_NANGO_WEBHOOK_URL'));
}

export function getNangoConnectionId(): string | undefined {
  return nonEmpty(env('COMPANY_BRAIN_NANGO_CONNECTION_ID'));
}

export function getNangoWebhookSecret(): string | undefined {
  return nonEmpty(env('COMPANY_BRAIN_NANGO_WEBHOOK_SECRET'));
}

export function getNangoPushTimeoutMs(): number {
  const rawTimeout = env('COMPANY_BRAIN_NANGO_PUSH_TIMEOUT_MS');
  if (!rawTimeout) {
    return DEFAULT_NANGO_PUSH_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(rawTimeout, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_NANGO_PUSH_TIMEOUT_MS;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => nonEmpty(value));
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function env(key: string): string | undefined {
  return process.env[key];
}
