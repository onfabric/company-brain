import { captureHookEvent, makeHookEnvelope } from './capture.js';
import { getCollectorUrl, getDataDir, getToken, isDebugEnabled } from './config.js';
import { pushConversationIfConfigured } from './nango-push.js';
import { AgentCaptureStore } from './store.js';
import type { AgentSource, HookEventEnvelope } from './types.js';

const REQUEST_TIMEOUT_MS = 1_500;
const CREATED_MIN_STATUS = 200;
const CREATED_MAX_STATUS = 299;

export async function runHook(source: AgentSource): Promise<void> {
  try {
    const input = await readStdin();
    const parsed = parseHookInput(input);
    const envelope = makeHookEnvelope(source, parsed);
    const sent = await sendToCollector(envelope);
    if (!sent) {
      const store = new AgentCaptureStore(getDataDir());
      const conversation = await captureHookEvent(store, envelope);
      await pushConversationIfConfigured(store, conversation);
    }
  } catch (error) {
    if (isDebugEnabled()) {
      console.error(error);
    }
  }
}

async function sendToCollector(envelope: HookEventEnvelope): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const token = getToken();
    const response = await fetch(`${getCollectorUrl()}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });
    return response.status >= CREATED_MIN_STATUS && response.status <= CREATED_MAX_STATUS;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseHookInput(input: string): Record<string, unknown> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, unknown>;
}
