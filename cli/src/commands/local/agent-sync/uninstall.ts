import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { uninstallAgentSyncForTarget } from '../../../lib/agent-sync/operations.ts';

export const command = defineCommand('local agent-sync uninstall', {
  description: 'Uninstall the local agent sync LaunchAgent.',
  options: {},
  handler: async ({ print }) => {
    intro('Company Brain local agent sync uninstall');
    const result = await uninstallAgentSyncForTarget('local');
    print.success(`Removed LaunchAgent: ${result.plistPath}`);
    outro('Local agent sync is uninstalled.');
  },
});
