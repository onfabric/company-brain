import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { syncAgentSyncNow } from '../../lib/agent-sync/operations.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { resolveCommandTarget, targetOptions } from '../../lib/target.ts';

export const command = defineCommand('agent-sync sync-now', {
  description: 'Scan local sessions and push new conversations once.',
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
    const result = await syncAgentSyncNow(target);
    print.info(options.json ? JSON.stringify(result, null, 2) : JSON.stringify(result));
  },
});
