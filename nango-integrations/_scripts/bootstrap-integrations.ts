import { INTEGRATIONS, type IntegrationSpec, NOT_FOUND_STATUS } from './nango-resources.js';

type IntegrationCredentials = {
  type?: string;
  client_id?: string | null;
  client_secret?: string | null;
  scopes?: string | null;
};

type IntegrationData = {
  unique_key: string;
  provider: string;
  display_name?: string | null;
  forward_webhooks?: boolean;
  credentials?: IntegrationCredentials | null;
};

type IntegrationResponse = {
  data?: IntegrationData;
  error?: unknown;
};

type V1IntegrationData = {
  provider: string;
  unique_key: string;
  display_name?: string | null;
  forward_webhooks?: boolean;
  oauth_client_id?: string | null;
};

type V1IntegrationResponse = {
  data?: {
    integration?: V1IntegrationData;
    meta?: {
      connectionsCount?: number;
    };
  };
  error?: unknown;
};

type PublicCreateIntegrationBody = {
  provider: string;
  unique_key: string;
  display_name: string;
  forward_webhooks: boolean;
  credentials?: {
    type: 'OAUTH2';
    client_id: string;
    client_secret: string;
    scopes?: string;
  };
};

type V1CreateIntegrationBody = {
  provider: string;
  useSharedCredentials: false;
  integrationId: string;
  displayName: string;
  forward_webhooks: boolean;
  auth: {
    authType: 'MCP_OAUTH2';
  };
};

type V1PatchIntegrationBody = {
  displayName: string;
  forward_webhooks: boolean;
};

const args = new Set(Bun.argv.slice(2));
const environment = firstPositionalArg() ?? env('NANGO_ENV') ?? 'dev';
const updateExisting = args.has('--update-existing');
const dryRun = args.has('--dry-run');
const baseUrl = requiredEnv('NANGO_HOSTPORT', 'NANGO_BASE_URL').replace(/\/+$/, '');
const secretKey = requiredEnv(`NANGO_SECRET_KEY_${environment.toUpperCase()}`, 'NANGO_SECRET_KEY');

await main();

async function main(): Promise<void> {
  log(`Bootstrapping ${INTEGRATIONS.length} Nango integration(s) for ${environment}`);

  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const spec of INTEGRATIONS) {
    const existing = await getIntegration(spec.id);

    if (!existing) {
      await createIntegration(spec);
      created.push(spec.id);
      continue;
    }

    validateExisting(spec, existing);

    if (updateExisting && (await repairMcpIntegrationIfNeeded(spec))) {
      updated.push(spec.id);
      continue;
    }

    if (!updateExisting) {
      unchanged.push(spec.id);
      continue;
    }

    if (needsUpdate(spec, existing)) {
      await updateIntegration(spec);
      updated.push(spec.id);
    } else {
      unchanged.push(spec.id);
    }
  }

  logSummary('Created', created);
  logSummary('Updated', updated);
  logSummary('Already configured', unchanged);
}

async function getIntegration(id: string): Promise<IntegrationData | null> {
  const response = await request(`/integrations/${encodeURIComponent(id)}?include=credentials`, {
    method: 'GET',
    allowNotFound: true,
  });

  if (response.status === NOT_FOUND_STATUS) {
    return null;
  }

  const body = await parseJson<IntegrationResponse>(response);
  if (!body.data) {
    throw new Error(`Nango returned no integration data for ${id}`);
  }

  return body.data;
}

async function createIntegration(spec: IntegrationSpec): Promise<void> {
  const body = createIntegrationBody(spec);
  if (dryRun) {
    log(`[dry-run] Would create ${spec.id}`);
    return;
  }

  await request(createIntegrationPath(spec), {
    method: 'POST',
    body,
  });
  log(`Created ${spec.id}`);
}

async function updateIntegration(spec: IntegrationSpec): Promise<void> {
  const patchBody = updateIntegrationBody(spec);
  if (dryRun) {
    log(`[dry-run] Would update ${spec.id}`);
    return;
  }

  await request(updateIntegrationPath(spec), {
    method: 'PATCH',
    body: patchBody,
  });
  log(`Updated ${spec.id}`);
}

async function deleteIntegration(id: string): Promise<void> {
  await request(v1IntegrationPath(id), {
    method: 'DELETE',
  });
  log(`Deleted ${id}`);
}

async function repairMcpIntegrationIfNeeded(spec: IntegrationSpec): Promise<boolean> {
  if (spec.authType !== 'MCP_OAUTH2') {
    return false;
  }

  const existing = await getV1Integration(spec.id);
  if (!existing || existing.integration.oauth_client_id) {
    return false;
  }

  if (existing.connectionsCount > 0) {
    throw new Error(
      `Integration ${spec.id} is missing its MCP OAuth client registration but has ${existing.connectionsCount} connection(s). Recreate it in the Nango dashboard or remove the connection(s), then rerun bootstrap.`,
    );
  }

  if (dryRun) {
    log(`[dry-run] Would recreate ${spec.id} with MCP OAuth client registration`);
    return true;
  }

  await deleteIntegration(spec.id);
  await createIntegration(spec);
  return true;
}

async function getV1Integration(
  id: string,
): Promise<{ integration: V1IntegrationData; connectionsCount: number } | null> {
  const response = await request(v1IntegrationPath(id), {
    method: 'GET',
    allowNotFound: true,
  });

  if (response.status === NOT_FOUND_STATUS) {
    return null;
  }

  const body = await parseJson<V1IntegrationResponse>(response);
  const integration = body.data?.integration;
  if (!integration) {
    throw new Error(`Nango returned no v1 integration data for ${id}`);
  }

  return {
    integration,
    connectionsCount: body.data?.meta?.connectionsCount ?? 0,
  };
}

function validateExisting(spec: IntegrationSpec, existing: IntegrationData): void {
  if (existing.provider !== spec.provider) {
    throw new Error(
      `Integration ${spec.id} already exists with provider ${existing.provider}, expected ${spec.provider}`,
    );
  }
}

function needsUpdate(spec: IntegrationSpec, existing: IntegrationData): boolean {
  if (existing.display_name && existing.display_name !== spec.displayName) {
    return true;
  }

  if (
    existing.forward_webhooks !== undefined &&
    existing.forward_webhooks !== spec.forwardWebhooks
  ) {
    return true;
  }

  if (!spec.oauth) {
    return false;
  }

  const credentials = existing.credentials;
  if (credentials?.type !== 'OAUTH2') {
    return true;
  }

  const clientId = optionalEnv(spec.oauth.clientIdEnv);
  if (clientId && credentials.client_id && credentials.client_id !== clientId) {
    return true;
  }

  return normalizeScopes(credentials.scopes) !== normalizeScopes(resolveScopes(spec));
}

function createIntegrationBody(
  spec: IntegrationSpec,
): PublicCreateIntegrationBody | V1CreateIntegrationBody {
  if (usesV1IntegrationApi(spec)) {
    return {
      provider: spec.provider,
      useSharedCredentials: false,
      integrationId: spec.id,
      displayName: spec.displayName,
      forward_webhooks: spec.forwardWebhooks,
      auth: {
        authType: spec.authType,
      },
    };
  }

  return publicIntegrationBody(spec);
}

function updateIntegrationBody(
  spec: IntegrationSpec,
): Omit<PublicCreateIntegrationBody, 'provider' | 'unique_key'> | V1PatchIntegrationBody {
  if (usesV1IntegrationApi(spec)) {
    return {
      displayName: spec.displayName,
      forward_webhooks: spec.forwardWebhooks,
    };
  }

  return publicIntegrationPatchBody(publicIntegrationBody(spec));
}

function publicIntegrationBody(spec: IntegrationSpec): PublicCreateIntegrationBody {
  const body: PublicCreateIntegrationBody = {
    provider: spec.provider,
    unique_key: spec.id,
    display_name: spec.displayName,
    forward_webhooks: spec.forwardWebhooks,
  };

  if (!spec.oauth) {
    return body;
  }

  const credentials: PublicCreateIntegrationBody['credentials'] = {
    type: 'OAUTH2',
    client_id: requiredEnv(spec.oauth.clientIdEnv),
    client_secret: requiredEnv(spec.oauth.clientSecretEnv),
  };

  const scopes = resolveScopes(spec);
  if (scopes) {
    credentials.scopes = scopes;
  }

  body.credentials = credentials;
  return body;
}

function createIntegrationPath(spec: IntegrationSpec): string {
  return usesV1IntegrationApi(spec) ? v1IntegrationPath() : '/integrations';
}

function updateIntegrationPath(spec: IntegrationSpec): string {
  return usesV1IntegrationApi(spec)
    ? v1IntegrationPath(spec.id)
    : `/integrations/${encodeURIComponent(spec.id)}`;
}

function v1IntegrationPath(id?: string): string {
  const suffix = id ? `/${encodeURIComponent(id)}` : '';
  return `/api/v1/integrations${suffix}?env=${encodeURIComponent(environment)}`;
}

function usesV1IntegrationApi(
  spec: IntegrationSpec,
): spec is IntegrationSpec & { authType: 'MCP_OAUTH2' } {
  return spec.authType === 'MCP_OAUTH2';
}

function resolveScopes(spec: IntegrationSpec): string | undefined {
  if (!spec.oauth) {
    return undefined;
  }

  return spec.oauth.scopesEnv
    ? (optionalEnv(spec.oauth.scopesEnv) ?? spec.oauth.scopes)
    : spec.oauth.scopes;
}

function publicIntegrationPatchBody(
  body: PublicCreateIntegrationBody,
): Omit<PublicCreateIntegrationBody, 'provider' | 'unique_key'> {
  const patchBody: Omit<PublicCreateIntegrationBody, 'provider' | 'unique_key'> = {
    display_name: body.display_name,
    forward_webhooks: body.forward_webhooks,
  };

  if (body.credentials) {
    patchBody.credentials = body.credentials;
  }

  return patchBody;
}

async function request(
  path: string,
  options: {
    method: 'DELETE' | 'GET' | 'POST' | 'PATCH';
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

function normalizeScopes(value: string | undefined | null): string {
  if (!value) {
    return '';
  }

  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .sort()
    .join(',');
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

function env(key: string): string | undefined {
  return optionalEnv(key);
}

function log(message: string): void {
  console.log(message);
}

function logSummary(label: string, values: string[]): void {
  if (values.length === 0) {
    return;
  }

  log(`${label}: ${values.join(', ')}`);
}
