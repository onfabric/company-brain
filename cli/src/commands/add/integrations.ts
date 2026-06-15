import { defineCommand } from '@parshjs/core';
import { addIntegrationsOptions } from '../../lib/add-command-options.ts';
import { addIntegrations } from '../../lib/integration-workflows.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { resolveCommandTarget, targetOptions } from '../../lib/target.ts';

export const command = defineCommand('add integrations', {
  description: 'Add integrations to the selected Nango target.',
  options: {
    ...targetOptions,
    ...addIntegrationsOptions,
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);

    await addIntegrations({
      target,
      nangoSecretKey: options['nango-secret-key'],
      nangoUrl: options['nango-url'],
      force: options.force,
      only: options.only,
      all: options.all,
      nonInteractive,
      verbose: Boolean(rootOptions.verbose),
      print,
    });
  },
});
