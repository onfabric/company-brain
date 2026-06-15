import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { installAgentSync } from '../../lib/agent-sync/operations.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('agent-sync install', {
  description: 'Install the hosted Company Brain agent conversation sync schedule.',
  options: {},
  handler: async ({ rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

    intro('Company Brain cloud agent sync install');
    const result = await installAgentSync({
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
    outro('Cloud agent sync is scheduled.');
  },
});
