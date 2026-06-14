import { defineCommand } from '@parshjs/core';
import { addSyncsOptions } from '../../../lib/add-command-options.ts';
import { addSyncs } from '../../../lib/integration-workflows.ts';
import { isNonInteractive } from '../../../lib/interaction.ts';

export const command = defineCommand('local add syncs', {
  description: 'Add syncs to the local Nango stack.',
  options: addSyncsOptions,
  handler: async ({ options, rootOptions, print }) => {
    await addSyncs({
      target: 'local',
      nangoSecretKey: options['nango-secret-key'],
      nangoUrl: options['nango-url'],
      only: options.only,
      all: options.all,
      nonInteractive: isNonInteractive(rootOptions['non-interactive']),
      verbose: Boolean(rootOptions.verbose),
      print,
    });
  },
});
