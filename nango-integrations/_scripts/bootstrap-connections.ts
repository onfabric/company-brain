import { BOOTSTRAPPED_CONNECTIONS, NOT_FOUND_STATUS } from './nango-resources.js';

type ConnectionData = {
  connection_id: string;
  provider_config_key: string;
};

type ConnectionResponse = {
  data?: ConnectionData;
  error?: unknown;
};

const environment = firstPositionalArg() ?? optionalEnv('NANGO_ENV') ?? 'dev';
const baseUrl = requiredEnv('NANGO_HOSTPORT', 'NANGO_BASE_URL').replace(/\/+$/, '');
const secretKey = requiredEnv(`NANGO_SECRET_KEY_${environment.toUpperCase()}`, 'NANGO_SECRET_KEY');

await main();

async function main(): Promise<void> {
  log(`Bootstrapping ${BOOTSTRAPPED_CONNECTIONS.length} Nango connection(s) for ${environment}`);

  for (const spec of BOOTSTRAPPED_CONNECTIONS) {
    const connectionId = optionalEnv(spec.connectionIdEnv) ?? spec.defaultConnectionId;
    const webhookSecret = requiredEnv(spec.bootstrap.webhookSecretEnv);
    const exists = await connectionExists(spec.integrationId, connectionId);

    if (exists) {
      await updateWebhookSecret(spec.integrationId, connectionId, webhookSecret);
      log(`Updated ${spec.integrationId}/${connectionId}`);
      continue;
    }

    await createUnauthenticatedConnection(spec.integrationId, connectionId, webhookSecret);
    log(`Created ${spec.integrationId}/${connectionId}`);
  }
}

async function connectionExists(integrationId: string, connectionId: string): Promise<boolean> {
  const response = await request(
    `/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(integrationId)}`,
    {
      method: 'GET',
      allowNotFound: true,
    },
  );

  if (response.status === NOT_FOUND_STATUS) {
    return false;
  }

  const body = await parseJson<ConnectionResponse>(response);
  if (!body.data) {
    throw new Error(`Nango returned no connection data for ${integrationId}/${connectionId}`);
  }

  return true;
}

async function createUnauthenticatedConnection(
  integrationId: string,
  connectionId: string,
  webhookSecret: string,
): Promise<void> {
  await request('/connections', {
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
  integrationId: string,
  connectionId: string,
  webhookSecret: string,
): Promise<void> {
  await request('/connections/metadata', {
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

async function request(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH';
    body?: unknown;
    allowNotFound?: boolean;
  },
): Promise<Response> {
  const headers = new Headers({
    authorization: `Bearer ${secretKey}`,
  });

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body,
  });

  if (options.allowNotFound && response.status === NOT_FOUND_STATUS) {
    return response;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method} ${path} failed with ${response.status}: ${text}`);
  }

  return response;
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
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
