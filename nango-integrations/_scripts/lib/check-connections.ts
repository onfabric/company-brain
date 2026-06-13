import { appendFile } from 'node:fs/promises';
import {
  type ConnectionSpec,
  DEFAULT_REQUIRED_CONNECTIONS,
  REQUIRED_CONNECTIONS,
} from './catalog.js';
import {
  type ConnectionData,
  type NangoApi,
  NOT_FOUND_STATUS,
  parseConnectionResponse,
  parseConnectionsResponse,
} from './nango-api.js';

type MissingConnection = {
  integrationId: string;
  connectionId: string;
};

export type CheckConnectionsOptions = {
  api: NangoApi;
  env: Record<string, string | undefined>;
  selectedIntegrationIds?: string[];
  summaryPath?: string;
  log?: (message: string) => void;
};

export async function checkConnections({
  api,
  env,
  selectedIntegrationIds,
  summaryPath,
  log = console.log,
}: CheckConnectionsOptions): Promise<void> {
  const specs = selectedIntegrationIds
    ? REQUIRED_CONNECTIONS.filter((spec) => selectedIntegrationIds.includes(spec.integrationId))
    : DEFAULT_REQUIRED_CONNECTIONS;

  log(`Checking ${specs.length} Nango connection(s)`);

  const missing: MissingConnection[] = [];

  for (const spec of specs) {
    const connectionId = optionalValue(env, spec.connectionIdEnv) ?? spec.defaultConnectionId;
    const connection = await findConnection(api, spec, connectionId);
    if (connection) {
      log(`Found ${spec.integrationId}/${connection.connection_id}`);
      continue;
    }

    missing.push({ integrationId: spec.integrationId, connectionId });
  }

  if (missing.length > 0) {
    const message = missingConnectionsMessage(missing);
    await appendStepSummary(summaryPath, message);
    throw new Error(message);
  }

  log('All required Nango connections exist.');
}

async function findConnection(
  api: NangoApi,
  spec: ConnectionSpec,
  connectionId: string,
): Promise<ConnectionData | null> {
  const exactConnection = await findConnectionById(api, spec.integrationId, connectionId);
  if (exactConnection || spec.bootstrap) {
    return exactConnection;
  }

  const integrationConnection = await findFirstConnectionForIntegration(api, spec.integrationId);
  if (integrationConnection) {
    return integrationConnection;
  }

  return null;
}

async function findConnectionById(
  api: NangoApi,
  integrationId: string,
  connectionId: string,
): Promise<ConnectionData | null> {
  const response = await api.request(
    `/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(integrationId)}`,
    { method: 'GET', allowNotFound: true },
  );

  if (response.status === NOT_FOUND_STATUS) {
    return null;
  }

  return parseConnectionResponse(response, integrationId, connectionId);
}

async function findFirstConnectionForIntegration(
  api: NangoApi,
  integrationId: string,
): Promise<ConnectionData | null> {
  const response = await api.request(
    `/connections?integrationId=${encodeURIComponent(integrationId)}&limit=1`,
    { method: 'GET' },
  );
  const body = await parseConnectionsResponse(response, integrationId);
  return body.connections[0] ?? null;
}

function missingConnectionsMessage(missing: MissingConnection[]): string {
  const lines = [
    'Missing Nango connections. Create these connections in the Nango dashboard, then rerun the workflow before deploying syncs:',
    ...missing.map(({ integrationId, connectionId }) => `- ${integrationId}/${connectionId}`),
  ];

  return lines.join('\n');
}

async function appendStepSummary(summaryPath: string | undefined, message: string): Promise<void> {
  if (!summaryPath) {
    return;
  }

  await appendFile(summaryPath, `## Nango connection gate\n\n${message}\n`);
}

function optionalValue(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}
