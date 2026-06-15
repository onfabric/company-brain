import { type AwsConfig, readAwsConfig, writeAwsConfig } from './aws-config.ts';
import { hostedExistingNangoEnv } from './hosted-nango-env.ts';
import { nangoIntegrationSpecs, nangoSyncSpecs } from './nango.ts';

type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

export type HostedNangoContext = {
  env: Record<string, string>;
  awsConfig?: AwsConfig;
};

export async function loadHostedNangoContext(overrides: {
  nangoSecretKey?: string;
  nangoUrl?: string;
}): Promise<HostedNangoContext> {
  const awsConfig = await readAwsConfig();
  return {
    env: hostedExistingNangoEnv(awsConfig, {
      nangoHostport: overrides.nangoUrl,
      nangoSecretKey: overrides.nangoSecretKey,
    }),
    awsConfig,
  };
}

export async function persistAddedIntegrations(
  context: HostedNangoContext,
  env: Record<string, string>,
  selected: IntegrationSpec[],
  integrationIds: string[],
): Promise<void> {
  if (!context.awsConfig) {
    return;
  }

  await writeHostedNangoConfig(context.awsConfig, env, selected, integrationIds);
}

export async function persistAddedSyncs(
  context: HostedNangoContext,
  integrationIds: string[],
): Promise<void> {
  if (!context.awsConfig) {
    return;
  }

  await writeAwsConfig({
    ...context.awsConfig,
    selectedIntegrationIds: integrationIds,
    syncsDeployedAt: new Date().toISOString(),
    secrets: {
      ...context.awsConfig.secrets,
      nangoSecretKey: context.env.NANGO_SECRET_KEY_DEV,
    },
  });
}

export function defaultIntegrationIds(context: HostedNangoContext): string[] {
  return context.awsConfig?.selectedIntegrationIds ?? [];
}

export function syncSelectionConfig(context: HostedNangoContext): {
  installedIntegrationIds: string[];
  selectedIntegrationIds: string[];
} {
  return {
    installedIntegrationIds: context.awsConfig?.selectedIntegrationIds ?? [],
    selectedIntegrationIds: context.awsConfig?.selectedIntegrationIds ?? [],
  };
}

export function integrationIdsInCatalogOrder(ids: string[]): string[] {
  return idsInPreferredOrder(
    ids,
    nangoIntegrationSpecs.map((integration) => integration.id),
  );
}

export function syncIntegrationIdsInCatalogOrder(ids: string[]): string[] {
  return idsInPreferredOrder(
    ids,
    nangoSyncSpecs.map((sync) => sync.integrationId),
  );
}

async function writeHostedNangoConfig(
  config: AwsConfig,
  env: Record<string, string>,
  selected: IntegrationSpec[],
  integrationIds: string[],
): Promise<void> {
  const oauth = { ...config.secrets.oauth };
  const scopes = { ...config.scopes };

  for (const integration of selected) {
    if (!integration.oauth) {
      continue;
    }

    oauth[integration.oauth.clientIdEnv] = requiredNangoEnv(env, integration.oauth.clientIdEnv);
    oauth[integration.oauth.clientSecretEnv] = requiredNangoEnv(
      env,
      integration.oauth.clientSecretEnv,
    );

    if (integration.oauth.scopesEnv && integration.oauth.scopes) {
      scopes[integration.oauth.scopesEnv] =
        env[integration.oauth.scopesEnv] ??
        scopes[integration.oauth.scopesEnv] ??
        integration.oauth.scopes;
    }
  }

  await writeAwsConfig({
    ...config,
    selectedIntegrationIds: integrationIds,
    nangoBootstrappedAt: new Date().toISOString(),
    syncsDeployedAt: sameItems(config.selectedIntegrationIds, integrationIds)
      ? config.syncsDeployedAt
      : undefined,
    scopes,
    secrets: {
      ...config.secrets,
      nangoSecretKey: env.NANGO_SECRET_KEY_DEV,
      oauth,
    },
  });
}

function requiredNangoEnv(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required Nango setting: ${key}`);
  }

  return value;
}

function idsInPreferredOrder(ids: string[], preferredOrder: string[]): string[] {
  const selected = new Set(ids);
  const ordered = preferredOrder.filter((id) => selected.has(id));
  const known = new Set(preferredOrder);
  const extra = ids.filter((id, index) => !known.has(id) && ids.indexOf(id) === index);

  return [...ordered, ...extra];
}

function sameItems(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightItems = new Set(right);
  return left.every((value) => rightItems.has(value));
}
