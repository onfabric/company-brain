import { defineCommand } from '@parshjs/core';
import { addIntegrationsOptions } from '../../lib/add-command-options.ts';
import { addIntegrations } from '../../lib/integration-workflows.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('add integrations', {
  description: 'Add integrations to hosted Company Brain Nango.',
  options: {
    ...addIntegrationsOptions,
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

    await addIntegrations({
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
