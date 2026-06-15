import { defineCommand } from '@parshjs/core';
import { runDaemon } from '../../../lib/agent-sync/daemon.ts';

export const command = defineCommand('cloud daemon agent-sync', {
  description: 'Run the long-lived cloud agent sync daemon.',
  options: {},
  handler: async () => {
    await runDaemon();
  },
});
