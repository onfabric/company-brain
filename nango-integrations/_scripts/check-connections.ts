import { appendFile } from 'node:fs/promises';
import type { ConnectionData, ConnectionSpec } from './nango-resources.js';
import {
  NOT_FOUND_STATUS,
  parseConnectionResponse,
  parseConnectionsResponse,
  REQUIRED_CONNECTIONS,
} from './nango-resources.js';

type MissingConnection = {
  integrationId: string;
  connectionId: string;
};

const environment = firstPositionalArg() ?? optionalEnv('NANGO_ENV') ?? 'dev';
const baseUrl = requiredEnv('NANGO_HOSTPORT', 'NANGO_BASE_URL').replace(/\/+$/, '');
const secretKey = requiredEnv(`NANGO_SECRET_KEY_${environment.toUpperCase()}`, 'NANGO_SECRET_KEY');

await main();

async function main(): Promise<void> {
  log(`Checking ${REQUIRED_CONNECTIONS.length} Nango connection(s) for ${environment}`);

  const missing: MissingConnection[] = [];

  for (const spec of REQUIRED_CONNECTIONS) {
    const connectionId = optionalEnv(spec.connectionIdEnv) ?? spec.defaultConnectionId;
    const connection = await findConnection(spec, connectionId);
    if (connection) {
      log(`Found ${spec.integrationId}/${connection.connection_id}`);
      continue;
    }

    missing.push({ integrationId: spec.integrationId, connectionId });
  }

  if (missing.length > 0) {
    const message = missingConnectionsMessage(missing);
    await appendStepSummary(message);
    throw new Error(message);
  }

  log('All required Nango connections exist.');
}

async function findConnection(
  spec: ConnectionSpec,
  connectionId: string,
): Promise<ConnectionData | null> {
  const exactConnection = await findConnectionById(spec.integrationId, connectionId);
  if (exactConnection || spec.bootstrap) {
    return exactConnection;
  }

  const integrationConnection = await findFirstConnectionForIntegration(spec.integrationId);
  if (integrationConnection) {
    return integrationConnection;
  }

  return null;
}

async function findConnectionById(
  integrationId: string,
  connectionId: string,
): Promise<ConnectionData | null> {
  const response = await request(
    `/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(integrationId)}`,
    { allowNotFound: true },
  );

  if (response.status === NOT_FOUND_STATUS) {
    return null;
  }

  return parseConnectionResponse(response, integrationId, connectionId);
}

async function findFirstConnectionForIntegration(
  integrationId: string,
): Promise<ConnectionData | null> {
  const response = await request(
    `/connections?integrationId=${encodeURIComponent(integrationId)}&limit=1`,
  );
  const body = await parseConnectionsResponse(response, integrationId);
  return body.connections[0] ?? null;
}

async function request(path: string, options: { allowNotFound?: boolean } = {}): Promise<Response> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${secretKey}`,
    },
  });

  if (options.allowNotFound && response.status === NOT_FOUND_STATUS) {
    return response;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${path} failed with ${response.status}: ${text}`);
  }

  return response;
}

function missingConnectionsMessage(missing: MissingConnection[]): string {
  const lines = [
    'Missing Nango connections. Create these connections in the Nango dashboard, then rerun the workflow before deploying syncs:',
    ...missing.map(({ integrationId, connectionId }) => `- ${integrationId}/${connectionId}`),
  ];

  return lines.join('\n');
}

async function appendStepSummary(message: string): Promise<void> {
  const summaryPath = optionalEnv('GITHUB_STEP_SUMMARY');
  if (!summaryPath) {
    return;
  }

  await appendFile(summaryPath, `## Nango connection gate\n\n${message}\n`);
}

function firstPositionalArg(): string | undefined {
  return Bun.argv.slice(2).find((arg) => !arg.startsWith('--'));
}

function requiredEnv(...keys: string[]): string {
  const value = keys.map(optionalEnv).find((candidate) => candidate);
  if (!value) {
    throw new Error(`Missing required environment variable: ${keys.join(' or ')}`);
  }

  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = Bun.env[key]?.trim();
  return value ? value : undefined;
}

function log(message: string): void {
  console.log(message);
}
