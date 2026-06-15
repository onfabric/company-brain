import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { agentSyncStatus, formatAgentSyncStatus } from '../../lib/agent-sync/operations.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { resolveCommandTarget, targetOptions } from '../../lib/target.ts';

export const command = defineCommand('agent-sync status', {
  description: 'Print selected target agent sync status.',
  options: {
    ...targetOptions,
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);
    const status = await agentSyncStatus(target);
    print.info(options.json ? JSON.stringify(status, null, 2) : formatAgentSyncStatus(status));
  },
});
