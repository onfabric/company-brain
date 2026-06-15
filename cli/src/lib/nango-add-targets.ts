import { type AwsConfig, readAwsConfig, writeAwsConfig } from './aws-config.ts';
import type { Target } from './deployment-target.ts';
import { hostedExistingNangoEnv } from './hosted-nango-env.ts';
import { type LocalConfig, readLocalConfig, writeLocalConfig } from './local-config.ts';
import { nangoIntegrationSpecs, nangoSyncSpecs } from './nango.ts';
import { applyNangoEnvOverrides, ensureNangoEnvBase, readNangoEnv } from './nango-env.ts';

type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

export type TargetContext = {
  target: Target;
  env: Record<string, string>;
  localConfig?: LocalConfig;
  awsConfig?: AwsConfig;
};

export async function loadTargetContext(
  target: Target,
  overrides: { nangoSecretKey?: string; nangoUrl?: string },
  prepareIntegrations: boolean,
): Promise<TargetContext> {
  const nangoOverrides = {
    nangoHostport: overrides.nangoUrl,
    nangoSecretKey: overrides.nangoSecretKey,
  };

  if (target === 'local') {
    if (prepareIntegrations) {
      await ensureNangoEnvBase();
    }

    return {
      target,
      env: applyNangoEnvOverrides(await readNangoEnv(), nangoOverrides),
      localConfig: await readLocalConfig(),
    };
  }

  const awsConfig = await readAwsConfig();
  return {
    target,
    env: hostedExistingNangoEnv(awsConfig, nangoOverrides),
    awsConfig,
  };
}

export async function persistAddedIntegrations(
  context: TargetContext,
  env: Record<string, string>,
  selected: IntegrationSpec[],
  integrationIds: string[],
): Promise<void> {
  if (context.target === 'local') {
    await writeLocalConfig({
      ...localConfigOrEmpty(context),
      installedIntegrationIds: integrationIds,
    });
    return;
  }

  if (!context.awsConfig) {
    return;
  }

  await writeHostedNangoConfig(context.awsConfig, env, selected, integrationIds);
}

export async function persistAddedSyncs(
  context: TargetContext,
  integrationIds: string[],
): Promise<void> {
  if (context.target === 'local') {
    await writeLocalConfig({
      ...localConfigOrEmpty(context),
      selectedIntegrationIds: integrationIds,
    });
    return;
  }

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

export function defaultIntegrationIds(context: TargetContext): string[] {
  if (context.target === 'local') {
    return context.localConfig?.installedIntegrationIds ?? [];
  }

  return context.awsConfig?.selectedIntegrationIds ?? [];
}

export function syncSelectionConfig(context: TargetContext): LocalConfig {
  if (context.target === 'local') {
    return localConfigOrEmpty(context);
  }

  return {
    installedIntegrationIds: context.awsConfig?.selectedIntegrationIds ?? [],
    selectedIntegrationIds: context.awsConfig?.selectedIntegrationIds ?? [],
  };
}

export function defaultNangoUrl(target: Target): string | undefined {
  return target === 'local' ? 'http://localhost:3003' : undefined;
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

function localConfigOrEmpty(context: TargetContext): LocalConfig {
  return context.localConfig ?? { installedIntegrationIds: [], selectedIntegrationIds: [] };
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
