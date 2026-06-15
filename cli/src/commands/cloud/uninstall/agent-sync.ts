import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { uninstallAgentSyncForTarget } from '../../../lib/agent-sync/operations.ts';

export const command = defineCommand('cloud uninstall agent-sync', {
  description: 'Uninstall the cloud agent sync LaunchAgent.',
  options: {},
  handler: async ({ print }) => {
    intro('Company Brain cloud agent sync uninstall');
    const result = await uninstallAgentSyncForTarget('cloud');
    print.success(`Removed LaunchAgent: ${result.plistPath}`);
    outro('Cloud agent sync is uninstalled.');
  },
});
