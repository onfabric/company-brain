import { defineCommand } from '@parshjs/core';
import { addSyncsOptions } from '../../lib/add-command-options.ts';
import { addSyncs } from '../../lib/integration-workflows.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { resolveCommandTarget, targetOptions } from '../../lib/target.ts';

export const command = defineCommand('add syncs', {
  description: 'Add syncs to the selected Nango target.',
  options: {
    ...targetOptions,
    ...addSyncsOptions,
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);

    await addSyncs({
      target,
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
