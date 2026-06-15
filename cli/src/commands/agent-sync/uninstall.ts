import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { uninstallAgentSyncForTarget } from '../../lib/agent-sync/operations.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { resolveCommandTarget, targetOptions } from '../../lib/target.ts';

export const command = defineCommand('agent-sync uninstall', {
  description: 'Uninstall the selected target agent sync LaunchAgent.',
  options: targetOptions,
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);

    intro(`Company Brain ${target} agent sync uninstall`);
    const result = await uninstallAgentSyncForTarget(target);
    print.success(`Removed LaunchAgent: ${result.plistPath}`);
    outro(`${target === 'local' ? 'Local' : 'Cloud'} agent sync is uninstalled.`);
  },
});
