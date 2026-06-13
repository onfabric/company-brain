import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { isNonInteractive } from '../../lib/interaction.ts';
import { readLocalConfig, writeLocalConfig } from '../../lib/local-config.ts';
import { readNangoEnv } from '../../lib/nango-env.ts';
import { deploySelectedSyncs, resolveSyncSelection } from '../../lib/sync-deployment.ts';

export const command = defineCommand('nango syncs', {
  description: 'Deploy syncs for the integrations installed in local Nango.',
  options: {
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

    const nangoEnv = await readNangoEnv();
    if (!nangoEnv.NANGO_SECRET_KEY_DEV) {
      throw new Error(
        'Missing NANGO_SECRET_KEY_DEV. Run `bun run company-brain nango integrations` first.',
      );
    }

    const config = await readLocalConfig();
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

    const integrationIds = await deploySelectedSyncs(selected, Boolean(rootOptions.verbose));

    await writeLocalConfig({ ...config, selectedIntegrationIds: integrationIds });

    print.success('Selected syncs are deployed.');
    outro('Company Brain ingestion is ready.');
  },
});
