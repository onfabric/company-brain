import {
  BOOTSTRAPPED_CONNECTIONS,
  NOT_FOUND_STATUS,
  parseConnectionResponse,
  resolveSelectedIntegrations,
} from '../nango-resources.js';
import type { NangoApi } from './nango-api.js';

export type BootstrapConnectionsOptions = {
  api: NangoApi;
  selectedIntegrationIds?: string[];
  env: Record<string, string | undefined>;
  log?: (message: string) => void;
};

export async function bootstrapConnections({
  api,
  selectedIntegrationIds,
  env,
  log = console.log,
}: BootstrapConnectionsOptions): Promise<void> {
  const selectedIds = new Set(
    resolveSelectedIntegrations(selectedIntegrationIds).map((integration) => integration.id),
  );
  const connections = BOOTSTRAPPED_CONNECTIONS.filter((connection) =>
    selectedIds.has(connection.integrationId),
  );
  log(`Bootstrapping ${connections.length} Nango connection(s)`);

  for (const spec of connections) {
    const connectionId = optionalValue(env, spec.connectionIdEnv) ?? spec.defaultConnectionId;
    const webhookSecret = requiredValue(env, spec.bootstrap.webhookSecretEnv);
    const exists = await connectionExists(api, spec.integrationId, connectionId);

    if (exists) {
      await updateWebhookSecret(api, spec.integrationId, connectionId, webhookSecret);
      log(`Updated ${spec.integrationId}/${connectionId}`);
      continue;
    }

    await createUnauthenticatedConnection(api, spec.integrationId, connectionId, webhookSecret);
    log(`Created ${spec.integrationId}/${connectionId}`);
  }
}

async function connectionExists(
  api: NangoApi,
  integrationId: string,
  connectionId: string,
): Promise<boolean> {
  const response = await api.request(
    `/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(integrationId)}`,
    {
      method: 'GET',
      allowNotFound: true,
    },
  );

  if (response.status === NOT_FOUND_STATUS) {
    return false;
  }

  await parseConnectionResponse(response, integrationId, connectionId);

  return true;
}

async function createUnauthenticatedConnection(
  api: NangoApi,
  integrationId: string,
  connectionId: string,
  webhookSecret: string,
): Promise<void> {
  await api.request('/connections', {
    method: 'POST',
    body: {
      provider_config_key: integrationId,
      connection_id: connectionId,
      credentials: {
        type: 'NONE',
      },
      metadata: {
        webhookSecret,
      },
    },
  });
}

async function updateWebhookSecret(
  api: NangoApi,
  integrationId: string,
  connectionId: string,
  webhookSecret: string,
): Promise<void> {
  await api.request('/connections/metadata', {
    method: 'PATCH',
    body: {
      provider_config_key: integrationId,
      connection_id: connectionId,
      metadata: {
        webhookSecret,
      },
    },
  });
}

function requiredValue(env: Record<string, string | undefined>, key: string): string {
  const value = optionalValue(env, key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function optionalValue(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}
