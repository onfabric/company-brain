import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { agentSyncStatus, formatAgentSyncStatus } from '../../lib/agent-sync/operations.ts';

export const command = defineCommand('agent-sync status', {
  description: 'Print hosted Company Brain agent sync status.',
  options: {
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, print }) => {
    const status = await agentSyncStatus();
    print.info(options.json ? JSON.stringify(status, null, 2) : formatAgentSyncStatus(status));
  },
});
