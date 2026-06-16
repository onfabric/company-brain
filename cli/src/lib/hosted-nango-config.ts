import {
  type CloudHostedNangoContext,
  cloudProviderById,
  requireCloudProvider,
} from './cloud-provider.ts';
import { nangoIntegrationSpecs, nangoSyncSpecs } from './nango.ts';

type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

export type HostedNangoContext = CloudHostedNangoContext;

export async function loadHostedNangoContext(overrides: {
  nangoSecretKey?: string;
  nangoUrl?: string;
}): Promise<HostedNangoContext> {
  return await (await requireCloudProvider()).loadHostedNangoContext(overrides);
}

export async function persistAddedIntegrations(
  context: HostedNangoContext,
  env: Record<string, string>,
  selected: IntegrationSpec[],
  integrationIds: string[],
): Promise<void> {
  await cloudProviderById(context.providerId).persistAddedIntegrations(
    context,
    env,
    selected,
    integrationIds,
  );
}

export async function persistAddedSyncs(
  context: HostedNangoContext,
  integrationIds: string[],
): Promise<void> {
  await cloudProviderById(context.providerId).persistAddedSyncs(context, integrationIds);
}

export function defaultIntegrationIds(context: HostedNangoContext): string[] {
  return cloudProviderById(context.providerId).defaultIntegrationIds(context);
}

export function syncSelectionConfig(context: HostedNangoContext): {
  installedIntegrationIds: string[];
  selectedIntegrationIds: string[];
} {
  return cloudProviderById(context.providerId).syncSelectionConfig(context);
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

function idsInPreferredOrder(ids: string[], preferredOrder: string[]): string[] {
  const selected = new Set(ids);
  const ordered = preferredOrder.filter((id) => selected.has(id));
  const known = new Set(preferredOrder);
  const extra = ids.filter((id, index) => !known.has(id) && ids.indexOf(id) === index);

  return [...ordered, ...extra];
}
