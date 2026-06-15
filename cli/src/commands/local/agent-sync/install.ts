import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { installAgentSyncForTarget } from '../../../lib/agent-sync/operations.ts';
import { isNonInteractive } from '../../../lib/interaction.ts';

export const command = defineCommand('local agent-sync install', {
  description: 'Install the local agent conversation sync daemon.',
  options: {},
  handler: async ({ rootOptions, print }) => {
    intro('Company Brain local agent sync install');
    const result = await installAgentSyncForTarget('local', {
      nonInteractive: isNonInteractive(rootOptions['non-interactive']),
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
    outro('Local agent sync is installed.');
  },
});
