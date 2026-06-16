import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireCloudProvider } from '../lib/cloud-provider.ts';

export const command = defineCommand('doctor', {
  description: 'Check hosted Company Brain setup health.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud check commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    await (await requireCloudProvider()).doctor(options, { rootOptions, print });
  },
});
