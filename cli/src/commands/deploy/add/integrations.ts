import { defineCommand } from '@parshjs/core';
import { addIntegrationsOptions } from '../../../lib/add-command-options.ts';
import { addIntegrations } from '../../../lib/integration-workflows.ts';
import { isNonInteractive } from '../../../lib/interaction.ts';

export const command = defineCommand('deploy add integrations', {
  description: 'Add integrations to the hosted deployment.',
  options: addIntegrationsOptions,
  handler: async ({ options, rootOptions, print }) => {
    await addIntegrations({
      target: 'deploy',
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
