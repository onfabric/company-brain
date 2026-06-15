import { defineCommand } from '@parshjs/core';
import { runDaemon } from '../../../lib/agent-sync/daemon.ts';

export const command = defineCommand('cloud agent-sync daemon', {
  description: 'Run the long-lived cloud agent sync daemon.',
  hidden: true,
  options: {},
  handler: async () => {
    await runDaemon();
  },
});
