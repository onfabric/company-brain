import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireCloudProvider } from '../lib/cloud-provider.ts';

export const command = defineCommand('update', {
  description: 'Update an existing hosted Company Brain deployment.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
    version: {
      schema: z.string().optional(),
      description: 'Deploy an exact Company Brain release version, such as v0.4.0.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    await (await requireCloudProvider()).update(options, { rootOptions, print });
  },
});
