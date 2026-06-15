import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { syncAgentSyncNow } from '../../lib/agent-sync/operations.ts';

export const command = defineCommand('agent-sync sync-now', {
  description: 'Scan local sessions and push new conversations once.',
  options: {
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, print }) => {
    const result = await syncAgentSyncNow();
    print.info(options.json ? JSON.stringify(result, null, 2) : JSON.stringify(result));
  },
});
