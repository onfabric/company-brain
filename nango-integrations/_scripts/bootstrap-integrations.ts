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

type CreateIntegrationBody = {
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
  const body = integrationBody(spec);
  if (dryRun) {
    log(`[dry-run] Would create ${spec.id}`);
    return;
  }

  await request('/integrations', {
    method: 'POST',
    body,
  });
  log(`Created ${spec.id}`);
}

async function updateIntegration(spec: IntegrationSpec): Promise<void> {
  const body = integrationBody(spec);
  const patchBody = integrationPatchBody(body);
  if (dryRun) {
    log(`[dry-run] Would update ${spec.id}`);
    return;
  }

  await request(`/integrations/${encodeURIComponent(spec.id)}`, {
    method: 'PATCH',
    body: patchBody,
  });
  log(`Updated ${spec.id}`);
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

function integrationBody(spec: IntegrationSpec): CreateIntegrationBody {
  const body: CreateIntegrationBody = {
    provider: spec.provider,
    unique_key: spec.id,
    display_name: spec.displayName,
    forward_webhooks: spec.forwardWebhooks,
  };

  if (!spec.oauth) {
    return body;
  }

  const credentials: CreateIntegrationBody['credentials'] = {
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

function resolveScopes(spec: IntegrationSpec): string | undefined {
  if (!spec.oauth) {
    return undefined;
  }

  return spec.oauth.scopesEnv
    ? (optionalEnv(spec.oauth.scopesEnv) ?? spec.oauth.scopes)
    : spec.oauth.scopes;
}

function integrationPatchBody(
  body: CreateIntegrationBody,
): Omit<CreateIntegrationBody, 'provider' | 'unique_key'> {
  const patchBody: Omit<CreateIntegrationBody, 'provider' | 'unique_key'> = {
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
