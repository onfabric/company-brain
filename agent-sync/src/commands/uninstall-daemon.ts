import { defineCommand } from '@parshjs/core';

import { getDataDir } from '../config.js';
import { uninstallLaunchAgent } from '../launchd.js';

export const command = defineCommand('uninstall-daemon', {
  description: 'Unload and remove the macOS LaunchAgent.',
  options: {},
  handler: async ({ print }) => {
    const result = await uninstallLaunchAgent(getDataDir());
    print.info(`Uninstalled ${result.label} from ${result.plistPath}`);
  },
});
