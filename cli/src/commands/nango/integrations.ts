import {
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  password,
  text,
} from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { isNonInteractive } from '../../lib/interaction.ts';
import { readLocalConfig, writeLocalConfig } from '../../lib/local-config.ts';
import { bootstrapNangoIntegrations, nangoIntegrationSpecs } from '../../lib/nango.ts';
import { ensureNangoEnvBase, readNangoEnv, upsertNangoEnv } from '../../lib/nango-env.ts';
import { parseSelectionAnswer } from '../../lib/selection.ts';
import { deploySelectedSyncs, syncsForIntegrationIds } from '../../lib/sync-deployment.ts';

type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

export const command = defineCommand('nango integrations', {
  description: 'Create selected Company Brain integrations in local Nango.',
  options: {
    nangoSecretKey: {
      schema: z.string().optional(),
      aliases: ['nango-api-key', 'nango-secret-key', 'api-key'],
      description: 'Nango dev API key from the local dashboard.',
    },
    force: {
      schema: z.boolean().optional(),
      description: 'Prompt for credentials even when they already exist.',
    },
    only: {
      schema: z.string().optional(),
      description: 'Comma-separated integration IDs or numbers to install, such as notion,slack.',
    },
    all: {
      schema: z.boolean().optional(),
      description: 'Install every Company Brain integration.',
    },
    deploySyncs: {
      schema: z.boolean().optional(),
      aliases: ['deploy-syncs'],
      description: 'Deploy syncs for the selected integrations after bootstrapping them.',
    },
    skipSyncs: {
      schema: z.boolean().optional(),
      aliases: ['skip-syncs'],
      description: 'Only create integrations; do not prompt to deploy syncs.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain Nango integrations');
    await ensureNangoEnvBase();
    const nonInteractive = isNonInteractive(rootOptions.nonInteractive);

    if (options.deploySyncs && options.skipSyncs) {
      throw new Error('Use either --deploy-syncs or --skip-syncs, not both.');
    }

    const selected = await resolveSelection(
      options.only,
      Boolean(options.all),
      nonInteractive,
    );
    if (selected.length === 0) {
      print.warn('No integrations selected.');
      outro('Nothing installed.');
      return;
    }

    note(
      [
        'Use this callback URL for local OAuth apps:',
        'http://localhost:3003/oauth/callback',
        '',
        'The script creates only the integrations you select, then can deploy syncs for those integrations after connections are ready.',
      ].join('\n'),
      'OAuth setup',
    );
    note(
      selected.map((integration) => integration.displayName).join('\n'),
      'Company Brain will install these integrations',
    );
    note(
      [
        'Paste each credential and press Enter.',
        'Existing values are reused unless --force is passed.',
      ].join('\n'),
      'Credential prompts',
    );

    const env = await collectNangoEnv(
      options.nangoSecretKey,
      selected,
      Boolean(options.force),
      nonInteractive,
    );
    await upsertNangoEnv(env);
    const integrationIds = selected.map((integration) => integration.id);
    await bootstrapNangoIntegrations(integrationIds, Boolean(rootOptions.verbose));

    const config = await readLocalConfig();
    await writeLocalConfig({ ...config, installedIntegrationIds: integrationIds });

    print.success('Selected local Nango integrations are configured.');
    await maybeDeploySyncs({
      integrationIds,
      skipSyncs: Boolean(options.skipSyncs),
      deploySyncs: Boolean(options.deploySyncs),
      nonInteractive,
      verbose: Boolean(rootOptions.verbose),
      print,
    });
  },
});

async function collectNangoEnv(
  nangoSecretKey: string | undefined,
  selected: IntegrationSpec[],
  force: boolean,
  nonInteractive: boolean,
): Promise<Record<string, string>> {
  const existing = await readNangoEnv();
  const values: Record<string, string> = {
    NANGO_HOSTPORT: existing.NANGO_HOSTPORT || 'http://localhost:3003',
    NANGO_SECRET_KEY_DEV:
      nangoSecretKey ??
      (await promptValue(
        'Nango dev API key',
        existing.NANGO_SECRET_KEY_DEV,
        force,
        true,
        nonInteractive,
      )),
  };

  for (const integration of selected) {
    if (!integration.oauth) {
      continue;
    }

    values[integration.oauth.clientIdEnv] = await promptValue(
      `${integration.displayName} client ID`,
      existing[integration.oauth.clientIdEnv],
      force,
      false,
      nonInteractive,
    );
    values[integration.oauth.clientSecretEnv] = await promptValue(
      `${integration.displayName} client secret`,
      existing[integration.oauth.clientSecretEnv],
      force,
      true,
      nonInteractive,
    );

    if (integration.oauth.scopesEnv && integration.oauth.scopes) {
      values[integration.oauth.scopesEnv] =
        existing[integration.oauth.scopesEnv] || integration.oauth.scopes;
    }
  }

  return values;
}

async function resolveSelection(
  only: string | undefined,
  all: boolean,
  nonInteractive: boolean,
): Promise<IntegrationSpec[]> {
  if (all) {
    return nangoIntegrationSpecs;
  }

  if (only) {
    const ids = parseSelectionAnswer(
      only,
      nangoIntegrationSpecs.map((integration) => ({
        id: integration.id,
        label: integration.displayName,
      })),
    );
    return nangoIntegrationSpecs.filter((integration) => ids.includes(integration.id));
  }

  if (nonInteractive) {
    throw new Error('Pass --only notion,slack or --all when running without a TTY.');
  }

  const answer = await multiselect({
    message: 'Which integrations should Company Brain install?',
    options: nangoIntegrationSpecs.map((integration) => ({
      value: integration.id,
      label: integration.displayName,
      hint: integration.provider,
    })),
    required: true,
  });

  if (isCancel(answer)) {
    throw new Error('Integration setup cancelled.');
  }

  return nangoIntegrationSpecs.filter((integration) => answer.includes(integration.id));
}

async function promptValue(
  label: string,
  existing: string | undefined,
  force: boolean,
  secret: boolean,
  nonInteractive: boolean,
): Promise<string> {
  if (existing && !force) {
    return existing;
  }

  if (nonInteractive) {
    throw new Error(`Missing required local Nango setting: ${label}`);
  }

  const answer = secret
    ? await password({
        message: formatPromptLabel(label, existing, true),
        validate: (value) => validateCredential(value, existing),
      })
    : await text({
        message: label,
        defaultValue: existing,
        validate: (value) => validateCredential(value, existing),
      });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  const value = answer || existing;

  if (!value) {
    throw new Error(`Missing required local Nango setting: ${label}`);
  }

  return value;
}

function formatPromptLabel(label: string, existing: string | undefined, secret: boolean): string {
  if (existing && secret) {
    return `${label} (press Enter to keep existing value)`;
  }

  return label;
}

function validateCredential(
  value: string | undefined,
  existing: string | undefined,
): string | undefined {
  if (!existing && (!value || value.trim().length === 0)) {
    return 'Required';
  }

  return undefined;
}

function selectedConnectionHints(integrationIds: string[]): string[] {
  const hints = oauthConnectionHints(integrationIds);

  return hints.length > 0 ? hints : ['No OAuth connections are needed for this selection.'];
}

function oauthConnectionHints(integrationIds: string[]): string[] {
  const selectedIds = new Set(integrationIds);
  const connectionHints: Array<[string, string]> = [
    ['notion', 'notion/notion'],
    ['slack', 'slack/slack'],
    ['github', 'github/github'],
    ['google-mail', 'google-mail/gmail'],
  ];

  return connectionHints.flatMap(([integrationId, hint]) =>
    selectedIds.has(integrationId) ? [hint] : [],
  );
}

async function maybeDeploySyncs({
  integrationIds,
  skipSyncs,
  deploySyncs,
  nonInteractive,
  verbose,
  print,
}: {
  integrationIds: string[];
  skipSyncs: boolean;
  deploySyncs: boolean;
  nonInteractive: boolean;
  verbose: boolean;
  print: { success: (message: string) => void };
}): Promise<void> {
  const connectionHints = oauthConnectionHints(integrationIds);
  const syncs = syncsForIntegrationIds(integrationIds);
  const command = `bun run company-brain nango syncs --only ${integrationIds.join(',')}`;

  note(
    [
      'Open the Nango dashboard and create OAuth connections for the providers you want now:',
      'http://localhost:3003',
      '',
      'Suggested connection IDs:',
      ...selectedConnectionHints(integrationIds),
    ].join('\n'),
    'Connection setup',
  );

  if (syncs.length === 0) {
    outro('Integrations are ready.');
    return;
  }

  if (skipSyncs || (nonInteractive && !deploySyncs)) {
    note(['When connections are ready, run:', command].join('\n'), 'Deploy syncs');
    outro('Integrations are ready.');
    return;
  }

  const shouldDeploy = deploySyncs || connectionHints.length === 0 || (await confirmSyncDeploy());
  if (!shouldDeploy) {
    note(['When connections are ready, run:', command].join('\n'), 'Deploy syncs');
    outro('Integrations are ready.');
    return;
  }

  note(
    syncs.map((sync) => sync.label).join('\n'),
    'Company Brain will ingest data from these syncs',
  );

  const deployedIntegrationIds = await deploySelectedSyncs(syncs, verbose);
  const config = await readLocalConfig();
  await writeLocalConfig({
    ...config,
    installedIntegrationIds: integrationIds,
    selectedIntegrationIds: deployedIntegrationIds,
  });

  print.success('Selected syncs are deployed.');
  outro('Company Brain ingestion is ready.');
}

async function confirmSyncDeploy(): Promise<boolean> {
  const answer = await confirm({
    message: 'Have you created the Nango connections and want to deploy syncs now?',
    initialValue: true,
  });

  if (isCancel(answer)) {
    throw new Error('Sync deployment cancelled.');
  }

  return answer;
}
