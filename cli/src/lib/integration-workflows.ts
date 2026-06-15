import { intro, isCancel, note, outro, text } from '@clack/prompts';
import { type Target, targetLabel } from './deployment-target.ts';
import { bootstrapNangoIntegrations } from './nango.ts';
import {
  collectNangoEnv,
  resolveIntegrationSelection,
  selectedConnectionHints,
} from './nango-add-prompts.ts';
import {
  defaultIntegrationIds,
  defaultNangoUrl,
  integrationIdsInCatalogOrder,
  loadTargetContext,
  persistAddedIntegrations,
  persistAddedSyncs,
  syncIntegrationIdsInCatalogOrder,
  syncSelectionConfig,
} from './nango-add-targets.ts';
import { normalizeNangoHostport, upsertNangoEnv } from './nango-env.ts';
import { deploySelectedSyncs, resolveSyncSelection } from './sync-deployment.ts';

type Printer = {
  success: (message: string) => void;
  warn: (message: string) => void;
};

export type AddIntegrationsInput = {
  target: Target;
  nangoSecretKey?: string;
  nangoUrl?: string;
  force?: boolean;
  only?: string;
  all?: boolean;
  nonInteractive: boolean;
  verbose: boolean;
  print: Printer;
};

export type AddSyncsInput = {
  target: Target;
  nangoSecretKey?: string;
  nangoUrl?: string;
  only?: string;
  all?: boolean;
  nonInteractive: boolean;
  verbose: boolean;
  print: Printer;
};

export async function addIntegrations({
  target,
  nangoSecretKey,
  nangoUrl,
  force,
  only,
  all,
  nonInteractive,
  verbose,
  print,
}: AddIntegrationsInput): Promise<void> {
  intro(`Company Brain ${targetLabel(target)} integrations`);

  const context = await loadTargetContext(target, { nangoSecretKey, nangoUrl }, true);
  const selected = await resolveIntegrationSelection(
    only,
    Boolean(all),
    nonInteractive,
    defaultIntegrationIds(context),
  );
  if (selected.length === 0) {
    print.warn('No integrations selected.');
    outro('Nothing added.');
    return;
  }

  const nangoHostport = normalizeNangoHostport(
    await requireValue(
      'Nango dashboard/API URL',
      context.env.NANGO_HOSTPORT || context.env.NANGO_BASE_URL || defaultNangoUrl(target),
      Boolean(force),
      nonInteractive,
    ),
  );

  note(
    [
      'Use this callback URL for OAuth apps:',
      `${nangoHostport}/oauth/callback`,
      '',
      'This creates the selected integrations. Create OAuth connections next, then add syncs.',
    ].join('\n'),
    'OAuth setup',
  );
  note(
    selected.map((integration) => integration.displayName).join('\n'),
    'Company Brain will add these integrations',
  );
  note(
    [
      'Paste each credential and press Enter.',
      'Existing values are reused unless --force is passed.',
    ].join('\n'),
    'Credential prompts',
  );

  const env = await collectNangoEnv(
    context.env,
    nangoHostport,
    selected,
    Boolean(force),
    nonInteractive,
    target,
  );

  if (target === 'local') {
    await upsertNangoEnv(env);
  }

  const addedIds = selected.map((integration) => integration.id);
  await bootstrapNangoIntegrations(addedIds, {
    env,
    verbose,
  });

  const allIds = integrationIdsInCatalogOrder([...defaultIntegrationIds(context), ...addedIds]);
  await persistAddedIntegrations(context, env, selected, allIds);

  print.success(`Selected ${targetLabel(target)} integrations are configured.`);
  note(
    [
      'Open the Nango dashboard and create OAuth connections for the providers you want now:',
      nangoHostport,
      '',
      'Suggested connection IDs:',
      ...selectedConnectionHints(addedIds),
      '',
      'After the connections are ready, run:',
      `company-brain add syncs --target ${target} --only ${addedIds.join(',')}`,
    ].join('\n'),
    'Next',
  );
  outro('Integrations are ready.');
}

export async function addSyncs({
  target,
  nangoSecretKey,
  nangoUrl,
  only,
  all,
  nonInteractive,
  verbose,
  print,
}: AddSyncsInput): Promise<void> {
  intro(`Company Brain ${targetLabel(target)} syncs`);

  const context = await loadTargetContext(target, { nangoSecretKey, nangoUrl }, false);
  if (!context.env.NANGO_SECRET_KEY_DEV) {
    throw new Error(
      `Missing NANGO_SECRET_KEY_DEV. Run \`company-brain resume --target ${target}\` to save the Nango API key, or pass --nango-secret-key.`,
    );
  }

  const selected = resolveSyncSelection(
    only,
    Boolean(all),
    nonInteractive,
    syncSelectionConfig(context),
  );
  if (selected.length === 0) {
    print.warn('No syncs selected.');
    outro('Nothing added.');
    return;
  }

  note(
    selected.map((sync) => sync.label).join('\n'),
    'Company Brain will ingest data from these syncs',
  );

  const addedIds = await deploySelectedSyncs(selected, {
    env: context.env,
    verbose,
  });
  const allIds = syncIntegrationIdsInCatalogOrder([
    ...syncSelectionConfig(context).selectedIntegrationIds,
    ...addedIds,
  ]);
  await persistAddedSyncs(context, allIds);

  print.success('Selected syncs are deployed.');
  outro('Company Brain ingestion is ready.');
}

async function requireValue(
  label: string,
  value: string | undefined,
  force: boolean,
  nonInteractive: boolean,
): Promise<string> {
  if (value && !force) {
    return value;
  }

  if (nonInteractive) {
    throw new Error(`Missing required Nango setting: ${label}`);
  }

  const answer = await text({
    message: label,
    validate: (input) => (input?.trim() ? undefined : 'Required'),
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  if (!answer) {
    throw new Error(`Missing required Nango setting: ${label}`);
  }

  return answer;
}
