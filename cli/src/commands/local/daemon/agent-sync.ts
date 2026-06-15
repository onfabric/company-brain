import { defineCommand } from '@parshjs/core';
import { runDaemon } from '../../../lib/agent-sync/daemon.ts';

export const command = defineCommand('local daemon agent-sync', {
  description: 'Run the long-lived local agent sync daemon.',
  options: {},
  handler: async () => {
    await runDaemon();
  },
});
