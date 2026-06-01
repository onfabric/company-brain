import { defineCommand } from '@parshjs/core';

import { loadConfig } from '../config.js';
import { ensureIdentity } from '../identity.js';
import { installLaunchAgent } from '../launchd.js';

export const command = defineCommand('install-daemon', {
  description: 'Install and start the macOS LaunchAgent.',
  options: {},
  handler: async ({ print }) => {
    const config = await loadConfig();
    await ensureIdentity(config.dataDir);
    const result = await installLaunchAgent(config.dataDir);
    print.info(`Installed ${result.label} at ${result.plistPath}`);
  },
});
