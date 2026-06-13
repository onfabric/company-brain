import {
  type IntegrationSpec,
  NOT_FOUND_STATUS,
  resolveSelectedIntegrations,
} from '../nango-resources.js';
import { type NangoApi, parseJson } from './nango-api.js';

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

export type BootstrapIntegrationsOptions = {
  api: NangoApi;
  updateExisting?: boolean;
  dryRun?: boolean;
  selectedIntegrationIds?: string[];
  env: Record<string, string | undefined>;
  log?: (message: string) => void;
};

export async function bootstrapIntegrations({
  api,
  updateExisting = false,
  dryRun = false,
  selectedIntegrationIds,
  env,
  log = console.log,
}: BootstrapIntegrationsOptions): Promise<void> {
  const integrations = resolveSelectedIntegrations(selectedIntegrationIds);
  log(`Bootstrapping ${integrations.length} Nango integration(s)`);

  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const spec of integrations) {
    const existing = await getIntegration(api, spec.id);

    if (!existing) {
      await createIntegration(api, spec, env, dryRun, log);
      created.push(spec.id);
      continue;
    }

    validateExisting(spec, existing);

    if (!updateExisting) {
      unchanged.push(spec.id);
      continue;
    }

    if (needsUpdate(spec, existing, env)) {
      await updateIntegration(api, spec, env, dryRun, log);
      updated.push(spec.id);
    } else {
      unchanged.push(spec.id);
    }
  }

  logSummary('Created', created, log);
  logSummary('Updated', updated, log);
  logSummary('Already configured', unchanged, log);
}

async function getIntegration(api: NangoApi, id: string): Promise<IntegrationData | null> {
  const response = await api.request(
    `/integrations/${encodeURIComponent(id)}?include=credentials`,
    {
      method: 'GET',
      allowNotFound: true,
    },
  );

  if (response.status === NOT_FOUND_STATUS) {
    return null;
  }

  const body = await parseJson<IntegrationResponse>(response);
  if (!body.data) {
    throw new Error(`Nango returned no integration data for ${id}`);
  }

  return body.data;
}

async function createIntegration(
  api: NangoApi,
  spec: IntegrationSpec,
  env: Record<string, string | undefined>,
  dryRun: boolean,
  log: (message: string) => void,
): Promise<void> {
  const body = integrationBody(spec, env);
  if (dryRun) {
    log(`[dry-run] Would create ${spec.id}`);
    return;
  }

  await api.request('/integrations', {
    method: 'POST',
    body,
  });
  log(`Created ${spec.id}`);
}

async function updateIntegration(
  api: NangoApi,
  spec: IntegrationSpec,
  env: Record<string, string | undefined>,
  dryRun: boolean,
  log: (message: string) => void,
): Promise<void> {
  const body = integrationBody(spec, env);
  const patchBody = integrationPatchBody(body);
  if (dryRun) {
    log(`[dry-run] Would update ${spec.id}`);
    return;
  }

  await api.request(`/integrations/${encodeURIComponent(spec.id)}`, {
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

function needsUpdate(
  spec: IntegrationSpec,
  existing: IntegrationData,
  env: Record<string, string | undefined>,
): boolean {
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

  const clientId = optionalValue(env, spec.oauth.clientIdEnv);
  if (clientId && credentials.client_id && credentials.client_id !== clientId) {
    return true;
  }

  return normalizeScopes(credentials.scopes) !== normalizeScopes(resolveScopes(spec, env));
}

function integrationBody(
  spec: IntegrationSpec,
  env: Record<string, string | undefined>,
): CreateIntegrationBody {
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
    client_id: requiredValue(env, spec.oauth.clientIdEnv),
    client_secret: requiredValue(env, spec.oauth.clientSecretEnv),
  };

  const scopes = resolveScopes(spec, env);
  if (scopes) {
    credentials.scopes = scopes;
  }

  body.credentials = credentials;
  return body;
}

function resolveScopes(
  spec: IntegrationSpec,
  env: Record<string, string | undefined>,
): string | undefined {
  if (!spec.oauth) {
    return undefined;
  }

  return spec.oauth.scopesEnv
    ? (optionalValue(env, spec.oauth.scopesEnv) ?? spec.oauth.scopes)
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

function logSummary(label: string, items: string[], log: (message: string) => void): void {
  log(`${label}: ${items.length > 0 ? items.join(', ') : 'none'}`);
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
