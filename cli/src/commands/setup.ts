import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { selectCloudProviderForSetup } from '../lib/cloud-provider.ts';

export const command = defineCommand('setup', {
  description: 'Provision and deploy hosted Company Brain.',
  options: {
    force: {
      schema: z.boolean().optional(),
      description: 'Regenerate or prompt for setup configuration.',
    },
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const provider = await selectCloudProviderForSetup();
    await provider.setup(options, { rootOptions, print });
  },
});
