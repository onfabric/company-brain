import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { installAgentSyncForTarget } from '../../lib/agent-sync/operations.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { resolveCommandTarget, targetOptions } from '../../lib/target.ts';

export const command = defineCommand('agent-sync install', {
  description: 'Install the selected target agent conversation sync schedule.',
  options: targetOptions,
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);

    intro(`Company Brain ${target} agent sync install`);
    const result = await installAgentSyncForTarget(target, {
      nonInteractive,
      verbose: Boolean(rootOptions.verbose),
      print,
    });
    note(
      [
        `Config: ${result.configPath}`,
        `LaunchAgent: ${result.launchAgentPath}`,
        `Logs: ${result.logDirectory}`,
        `Webhook: ${result.webhookUrl}`,
      ].join('\n'),
      'Agent sync',
    );
    outro(`${target === 'local' ? 'Local' : 'Cloud'} agent sync is scheduled.`);
  },
});
