import type { LocalConfig } from './local-config.ts';
import { checkNangoConnections, deployNangoSyncs, nangoSyncSpecs } from './nango.ts';
import { parseSelectionAnswer } from './selection.ts';

export type SyncSpec = (typeof nangoSyncSpecs)[number];

export function resolveSyncSelection(
  only: string | undefined,
  all: boolean,
  nonInteractive: boolean,
  config: LocalConfig,
): SyncSpec[] {
  if (all) {
    return nangoSyncSpecs;
  }

  if (only) {
    const ids = parseSelectionAnswer(
      only,
      nangoSyncSpecs.map((sync) => ({ id: sync.integrationId, label: sync.label })),
    );
    return nangoSyncSpecs.filter((sync) => ids.includes(sync.integrationId));
  }

  const availableIds =
    config.installedIntegrationIds.length > 0
      ? config.installedIntegrationIds
      : config.selectedIntegrationIds;
  if (availableIds.length > 0) {
    return nangoSyncSpecs.filter((sync) => availableIds.includes(sync.integrationId));
  }

  if (nonInteractive) {
    throw new Error('Pass --only notion,slack or --all when running without a TTY.');
  }

  throw new Error(
    'No installed integrations found. Run `bun run company-brain nango integrations` first, or pass --all.',
  );
}

export function syncsForIntegrationIds(integrationIds: string[]): SyncSpec[] {
  const selectedIds = new Set(integrationIds);
  return nangoSyncSpecs.filter((sync) => selectedIds.has(sync.integrationId));
}

export async function deploySelectedSyncs(
  selected: SyncSpec[],
  verbose: boolean,
): Promise<string[]> {
  const integrationIds = selected.map((sync) => sync.integrationId);
  await checkNangoConnections(integrationIds, verbose);
  await deployNangoSyncs(integrationIds, verbose);

  return integrationIds;
}
