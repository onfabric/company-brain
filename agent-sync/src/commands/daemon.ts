import { defineCommand } from '@parshjs/core';

import { runDaemon } from '../daemon.js';

export const command = defineCommand('daemon', {
  description: 'Run the long-lived local sync daemon.',
  options: {},
  handler: async () => {
    await runDaemon();
  },
});
