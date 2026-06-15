import { defineCommand } from '@parshjs/core';
import { addSyncsOptions } from '../../lib/add-command-options.ts';
import { addSyncs } from '../../lib/integration-workflows.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('add syncs', {
  description: 'Add syncs to hosted Company Brain Nango.',
  options: {
    ...addSyncsOptions,
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

    await addSyncs({
      nangoSecretKey: options['nango-secret-key'],
      nangoUrl: options['nango-url'],
      only: options.only,
      all: options.all,
      nonInteractive,
      verbose: Boolean(rootOptions.verbose),
      print,
    });
  },
});
