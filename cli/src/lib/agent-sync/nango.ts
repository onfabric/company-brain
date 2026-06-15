import { bootstrapNangoIntegrations } from '../nango.ts';
import { deploySelectedSyncs, syncsForIntegrationIds } from '../sync-deployment.ts';

export const AGENT_CONVERSATIONS_INTEGRATION_ID = 'agent-conversations';
export const AGENT_SYNC_CONNECTION_ID = 'local-agent-sync';

const FETCH_TIMEOUT_MS = 10_000;

type EnsureAgentConversationsOptions = {
  nangoUrl: string;
  nangoSecretKey: string;
  webhookSecret: string;
  verbose: boolean;
};

type PublicIntegrationResponse = {
  data?: {
    webhook_url?: unknown;
  };
};

export async function ensureAgentConversationsNango({
  nangoUrl,
  nangoSecretKey,
  webhookSecret,
  verbose,
}: EnsureAgentConversationsOptions): Promise<{ webhookUrl: string; connectionId: string }> {
  const env = {
    NANGO_HOSTPORT: nangoUrl,
    NANGO_SECRET_KEY_DEV: nangoSecretKey,
    AGENT_SYNC_WEBHOOK_SECRET: webhookSecret,
  };
  await bootstrapNangoIntegrations([AGENT_CONVERSATIONS_INTEGRATION_ID], { env, verbose });
  await deploySelectedSyncs(syncsForIntegrationIds([AGENT_CONVERSATIONS_INTEGRATION_ID]), {
    env,
    verbose,
  });

  return {
    webhookUrl: await fetchAgentConversationsWebhookUrl(nangoUrl, nangoSecretKey),
    connectionId: AGENT_SYNC_CONNECTION_ID,
  };
}

async function fetchAgentConversationsWebhookUrl(
  nangoUrl: string,
  nangoSecretKey: string,
): Promise<string> {
  const response = await fetch(
    `${nangoUrl}/integrations/${encodeURIComponent(AGENT_CONVERSATIONS_INTEGRATION_ID)}?include=webhook`,
    {
      headers: { authorization: `Bearer ${nangoSecretKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to read ${AGENT_CONVERSATIONS_INTEGRATION_ID} webhook URL from Nango: HTTP ${response.status}`,
    );
  }

  const body = (await response.json()) as PublicIntegrationResponse;
  if (typeof body.data?.webhook_url !== 'string' || body.data.webhook_url.length === 0) {
    throw new Error(
      `Nango did not return a webhook URL for ${AGENT_CONVERSATIONS_INTEGRATION_ID}.`,
    );
  }

  return body.data.webhook_url;
}
