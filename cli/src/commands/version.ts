import { defineCommand } from '@parshjs/core';
import { CLI_VERSION } from '../lib/version.ts';

export const command = defineCommand('version', {
  description: 'Print the installed Company Brain CLI version.',
  options: {},
  handler: () => {
    console.log(`company-brain ${CLI_VERSION}`);
  },
});
