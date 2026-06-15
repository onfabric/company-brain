import type { AgentSyncConfig } from './config.ts';
import type { AgentConversation } from './types.ts';
import { nowIso } from './utils.ts';

export const NANGO_WEBHOOK_TYPE = 'agent.conversation.upsert';

export interface PushResult {
  status: 'failed' | 'pushed';
  error?: string | undefined;
}

export async function pushConversation(
  config: AgentSyncConfig,
  conversation: AgentConversation,
): Promise<PushResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.nangoPushTimeoutMs);

    try {
      const response = await fetch(config.nangoWebhookUrl ?? '', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: NANGO_WEBHOOK_TYPE,
          connectionId: config.nangoConnectionId,
          sentAt: nowIso(),
          records: [conversation],
          secret: config.nangoWebhookSecret,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Nango webhook returned ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }

    return { status: 'pushed' };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
