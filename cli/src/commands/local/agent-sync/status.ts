import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { agentSyncStatus, formatAgentSyncStatus } from '../../../lib/agent-sync/operations.ts';

export const command = defineCommand('local agent-sync status', {
  description: 'Print local agent sync daemon status.',
  options: {
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, print }) => {
    const status = await agentSyncStatus('local');
    print.info(options.json ? JSON.stringify(status, null, 2) : formatAgentSyncStatus(status));
  },
});
