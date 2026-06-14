import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { readAwsConfig, type AwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { hostedExistingNangoEnv } from '../../lib/hosted-nango-env.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { readLocalConfig, writeLocalConfig } from '../../lib/local-config.ts';
import { applyNangoEnvOverrides, readNangoEnv } from '../../lib/nango-env.ts';
import { deploySelectedSyncs, resolveSyncSelection } from '../../lib/sync-deployment.ts';

export const command = defineCommand('nango syncs', {
  description: 'Deploy syncs for the integrations installed in Nango.',
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
      description: 'Deploy syncs to the hosted AWS Nango deployment instead of local .env files.',
    },
    only: {
      schema: z.string().optional(),
      description: 'Comma-separated integration IDs or numbers to deploy, such as notion,slack.',
    },
    all: {
      schema: z.boolean().optional(),
      description: 'Deploy every Company Brain sync.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain sync deployment');

    const hosted = Boolean(options.hosted);
    const awsConfig = hosted ? await readAwsConfig() : undefined;
    const nangoEnv = hosted
      ? hostedExistingNangoEnv(awsConfig, {
          nangoHostport: options.nangoHostport,
          nangoSecretKey: options.nangoSecretKey,
        })
      : applyNangoEnvOverrides(await readNangoEnv(), {
          nangoHostport: options.nangoHostport,
          nangoSecretKey: options.nangoSecretKey,
        });
    if (!nangoEnv.NANGO_SECRET_KEY_DEV) {
      throw new Error(
        `Missing NANGO_SECRET_KEY_DEV. Run \`bun run company-brain nango integrations${hosted ? ' --hosted' : ''}\` first.`,
      );
    }

    const config = hosted
      ? {
          installedIntegrationIds: awsConfig?.selectedIntegrationIds ?? [],
          selectedIntegrationIds: awsConfig?.selectedIntegrationIds ?? [],
        }
      : await readLocalConfig();
    const selected = resolveSyncSelection(
      options.only,
      Boolean(options.all),
      isNonInteractive(rootOptions.nonInteractive),
      config,
    );
    if (selected.length === 0) {
      print.warn('No syncs selected.');
      outro('Nothing deployed.');
      return;
    }

    note(
      selected.map((sync) => sync.label).join('\n'),
      'Company Brain will ingest data from these syncs',
    );

    const integrationIds = await deploySelectedSyncs(selected, {
      env: hosted ? nangoEnv : undefined,
      verbose: Boolean(rootOptions.verbose),
    });

    if (!hosted) {
      await writeLocalConfig({ ...config, selectedIntegrationIds: integrationIds });
    } else if (awsConfig) {
      await writeHostedSyncConfig(awsConfig, nangoEnv, integrationIds);
    }

    print.success('Selected syncs are deployed.');
    outro('Company Brain ingestion is ready.');
  },
});

async function writeHostedSyncConfig(
  config: AwsConfig,
  env: Record<string, string>,
  integrationIds: string[],
): Promise<void> {
  await writeAwsConfig({
    ...config,
    selectedIntegrationIds: integrationIds,
    syncsDeployedAt: new Date().toISOString(),
    secrets: {
      ...config.secrets,
      nangoSecretKey: env.NANGO_SECRET_KEY_DEV,
    },
  });
}
