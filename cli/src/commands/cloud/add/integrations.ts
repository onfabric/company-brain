import { defineCommand } from '@parshjs/core';
import { addIntegrationsOptions } from '../../../lib/add-command-options.ts';
import { addIntegrations } from '../../../lib/integration-workflows.ts';
import { isNonInteractive } from '../../../lib/interaction.ts';

export const command = defineCommand('cloud add integrations', {
  description: 'Add integrations to the cloud.',
  options: addIntegrationsOptions,
  handler: async ({ options, rootOptions, print }) => {
    await addIntegrations({
      target: 'cloud',
      nangoSecretKey: options['nango-secret-key'],
      nangoUrl: options['nango-url'],
      force: options.force,
      only: options.only,
      all: options.all,
      nonInteractive: isNonInteractive(rootOptions['non-interactive']),
      verbose: Boolean(rootOptions.verbose),
      print,
    });
  },
});
