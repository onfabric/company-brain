import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { uninstallAgentSync } from '../../lib/agent-sync/operations.ts';

export const command = defineCommand('agent-sync uninstall', {
  description: 'Uninstall the hosted Company Brain agent sync LaunchAgent.',
  options: {},
  handler: async ({ print }) => {
    intro('Company Brain cloud agent sync uninstall');
    const result = await uninstallAgentSync();
    print.success(`Removed LaunchAgent: ${result.plistPath}`);
    outro('Cloud agent sync is uninstalled.');
  },
});
