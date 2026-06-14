import {
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
import { oauthConnectionHints } from '../../../../nango-integrations/_scripts/lib/catalog.ts';
import { parseSelection } from '../../../../nango-integrations/_scripts/lib/selection.ts';
import { readAwsConfig, type AwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { hostedExistingNangoEnv } from '../../lib/hosted-nango-env.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { readLocalConfig, writeLocalConfig } from '../../lib/local-config.ts';
import {
  bootstrappedConnectionIntegrationIds,
  bootstrapNangoIntegrations,
  nangoIntegrationSpecs,
} from '../../lib/nango.ts';
import {
  applyNangoEnvOverrides,
  ensureNangoEnvBase,
  normalizeNangoHostport,
  readNangoEnv,
  upsertNangoEnv,
} from '../../lib/nango-env.ts';

type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

export const command = defineCommand('nango integrations', {
  description: 'Create selected Company Brain integrations in Nango.',
  options: {
    nangoSecretKey: {
      schema: z.string().optional(),
      aliases: ['nango-api-key', 'nango-secret-key', 'api-key'],
      description: 'Nango dev API key.',
    },
    nangoHostport: {
      schema: z.string().optional(),
      aliases: ['nango-url', 'nango-base-url', 'nango-hostport'],
      description: 'Nango dashboard/API base URL.',
    },
    hosted: {
      schema: z.boolean().optional(),
      description: 'Configure the hosted AWS Nango deployment instead of local .env files.',
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
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain Nango integrations');
    const nonInteractive = isNonInteractive(rootOptions.nonInteractive);
    const hosted = Boolean(options.hosted);
    const awsConfig = hosted ? await readAwsConfig() : undefined;

    if (!hosted) {
      await ensureNangoEnvBase();
    }

    const selected = await resolveSelection(
      options.only,
      Boolean(options.all),
      nonInteractive,
      hosted ? awsConfig?.selectedIntegrationIds : undefined,
    );
    if (selected.length === 0) {
      print.warn('No integrations selected.');
      outro('Nothing installed.');
      return;
    }

    const existing = hosted
      ? hostedExistingNangoEnv(awsConfig, {
          nangoHostport: options.nangoHostport,
          nangoSecretKey: options.nangoSecretKey,
        })
      : applyNangoEnvOverrides(await readNangoEnv(), {
          nangoHostport: options.nangoHostport,
          nangoSecretKey: options.nangoSecretKey,
        });
    const nangoHostport = normalizeNangoHostport(
      await promptValue(
        'Nango dashboard/API URL',
        existing.NANGO_HOSTPORT ||
          existing.NANGO_BASE_URL ||
          (hosted ? undefined : 'http://localhost:3003'),
        Boolean(options.force),
        false,
        nonInteractive,
      ),
    );

    note(
      [
        'Use this callback URL for OAuth apps:',
        `${nangoHostport}/oauth/callback`,
        '',
        'This creates only the integrations you select. Create OAuth connections next, then deploy syncs.',
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
      existing,
      nangoHostport,
      selected,
      Boolean(options.force),
      nonInteractive,
      hosted,
    );
    if (!hosted) {
      await upsertNangoEnv(env);
    }

    const integrationIds = selected.map((integration) => integration.id);
    await bootstrapNangoIntegrations(integrationIds, {
      env: hosted ? env : undefined,
      verbose: Boolean(rootOptions.verbose),
    });

    if (!hosted) {
      const config = await readLocalConfig();
      await writeLocalConfig({ ...config, installedIntegrationIds: integrationIds });
    } else if (awsConfig) {
      await writeHostedNangoConfig(awsConfig, env, selected, integrationIds);
    }

    print.success(`Selected ${hosted ? 'hosted' : 'local'} Nango integrations are configured.`);
    note(
      [
        'Open the Nango dashboard and create OAuth connections for the providers you want now:',
        nangoHostport,
        '',
        'Suggested connection IDs:',
        ...selectedConnectionHints(integrationIds),
        '',
        'After the connections are ready, run:',
        `bun run company-brain nango syncs${hosted ? ' --hosted' : ''} --only ${integrationIds.join(',')}`,
      ].join('\n'),
      'Next',
    );
    outro('Integrations are ready.');
  },
});

async function collectNangoEnv(
  existing: Record<string, string>,
  nangoHostport: string,
  selected: IntegrationSpec[],
  force: boolean,
  nonInteractive: boolean,
  hosted: boolean,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {
    ...existing,
    NANGO_HOSTPORT: nangoHostport,
    NANGO_SECRET_KEY_DEV: await promptValue(
      hosted ? 'Hosted Nango dev API key' : 'Nango dev API key',
      existing.NANGO_SECRET_KEY_DEV,
      force,
      true,
      nonInteractive,
    ),
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
  defaultIntegrationIds?: string[],
): Promise<IntegrationSpec[]> {
  if (all) {
    return nangoIntegrationSpecs;
  }

  if (only) {
    const ids = parseSelection(
      only,
      nangoIntegrationSpecs.map((integration) => integration.id),
    );
    return nangoIntegrationSpecs.filter((integration) => ids.includes(integration.id));
  }

  if (defaultIntegrationIds && defaultIntegrationIds.length > 0) {
    const selected = new Set(defaultIntegrationIds);
    return nangoIntegrationSpecs.filter((integration) => selected.has(integration.id));
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
        env[integration.oauth.scopesEnv] ?? scopes[integration.oauth.scopesEnv] ?? integration.oauth.scopes;
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

function sameItems(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightItems = new Set(right);
  return left.every((value) => rightItems.has(value));
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
    throw new Error(`Missing required Nango setting: ${label}`);
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
    throw new Error(`Missing required Nango setting: ${label}`);
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
  const bootstrappedIds = bootstrappedConnectionIntegrationIds(integrationIds);
  if (bootstrappedIds.length > 0) {
    hints.push(
      ...bootstrappedIds.map((integrationId) => `${integrationId} is created by the CLI`),
    );
  }

  return hints.length > 0 ? hints : ['No OAuth connections are needed for this selection.'];
}
