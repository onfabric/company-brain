import { captureHookEvent } from './capture.js';
import {
  getDataDir,
  getPort,
  getScanIntervalMs,
  getToken,
  isDebugEnabled,
  isLocalSessionScanEnabled,
} from './config.js';
import { pushConversationIfConfigured } from './nango-push.js';
import { scanLocalSessions } from './session-scanner.js';
import { AgentCaptureStore } from './store.js';
import type { AgentSource, HookEventEnvelope } from './types.js';

const JSON_HEADERS = { 'content-type': 'application/json' };
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const SERVER_ERROR_STATUS = 500;

export function startServer(
  options: { dataDir?: string; port?: number; token?: string } = {},
): void {
  const dataDir = options.dataDir ?? getDataDir();
  const port = options.port ?? getPort();
  const token = options.token ?? getToken();
  const store = new AgentCaptureStore(dataDir);
  if (isLocalSessionScanEnabled()) {
    startLocalSessionScanner(store);
  }

  Bun.serve({
    port,
    async fetch(request) {
      try {
        return await handleRequest(request, store, token);
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : 'Internal server error' },
          SERVER_ERROR_STATUS,
        );
      }
    },
  });

  console.log(`agent-capture collector listening on http://127.0.0.1:${port}`);
  console.log(`agent-capture data dir: ${dataDir}`);
}

function startLocalSessionScanner(store: AgentCaptureStore): void {
  const runScan = async () => {
    try {
      await scanLocalSessions(store);
    } catch (error) {
      if (isDebugEnabled()) {
        console.error(error);
      }
    }
  };

  void runScan();
  setInterval(() => {
    void runScan();
  }, getScanIntervalMs());
}

async function handleRequest(
  request: Request,
  store: AgentCaptureStore,
  token: string | undefined,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/health') {
    return jsonResponse({ ok: true }, OK_STATUS);
  }

  if (token && request.headers.get('authorization') !== `Bearer ${token}`) {
    return jsonResponse({ error: 'Unauthorized' }, UNAUTHORIZED_STATUS);
  }

  if (request.method === 'POST' && url.pathname === '/events') {
    const body = await request.json();
    const envelope = parseEnvelope(body);
    if (!envelope) {
      return jsonResponse({ error: 'Invalid hook event envelope' }, BAD_REQUEST_STATUS);
    }
    const conversation = await captureHookEvent(store, envelope);
    void pushConversationIfConfigured(store, conversation);
    return jsonResponse({ ok: true, id: conversation.id }, CREATED_STATUS);
  }

  if (request.method === 'POST' && url.pathname === '/scan') {
    const response = await scanLocalSessions(store, {
      all: url.searchParams.get('all') === '1',
    });
    return jsonResponse(response, OK_STATUS);
  }

  return jsonResponse({ error: 'Not found' }, NOT_FOUND_STATUS);
}

function parseEnvelope(value: unknown): HookEventEnvelope | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const source = field(record, 'source');
  const receivedAt = field(record, 'received_at');
  const event = field(record, 'event');
  if (!isSource(source) || typeof receivedAt !== 'string' || !isRecord(event)) {
    return undefined;
  }

  return { source, received_at: receivedAt, event };
}

function isSource(value: unknown): value is AgentSource {
  return value === 'claude-code' || value === 'codex';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}
