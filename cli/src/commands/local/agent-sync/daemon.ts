import { defineCommand } from '@parshjs/core';
import { runDaemon } from '../../../lib/agent-sync/daemon.ts';

export const command = defineCommand('local agent-sync daemon', {
  description: 'Run the long-lived local agent sync daemon.',
  hidden: true,
  options: {},
  handler: async () => {
    await runDaemon();
  },
});
