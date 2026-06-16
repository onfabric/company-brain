import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireCloudProvider } from '../lib/cloud-provider.ts';

export const command = defineCommand('resume', {
  description: 'Resume hosted Company Brain setup or deployment.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    await (await requireCloudProvider()).resume(options, { rootOptions, print });
  },
});
