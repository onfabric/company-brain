import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { startLocalStack, verifyLocalPrerequisites } from '../../lib/docker.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { ensureRootEnv } from '../../lib/local-env.ts';
import { ensureLocalNangoApiKey } from '../../lib/nango-api-key.ts';
import { ensureNangoEnvBase } from '../../lib/nango-env.ts';

export const command = defineCommand('local resume', {
  description: 'Resume local setup after starting Nango or copying its API key.',
  options: {},
  handler: async ({ rootOptions, print }) => {
    intro('Company Brain local resume');

    await ensureRootEnv();
    await ensureNangoEnvBase();

    const issues = await verifyLocalPrerequisites();
    if (issues.length > 0) {
      for (const issue of issues) {
        print.warn(issue);
      }
      outro('Fix the prerequisites above, then run `bun run company-brain local resume` again.');
      return;
    }

    await startLocalStack(Boolean(rootOptions.verbose));
    print.success('Local Docker stack is healthy.');
    await ensureLocalNangoApiKey(isNonInteractive(rootOptions['non-interactive']), print);

    note(
      [
        'Brain dashboard: http://localhost:3010/',
        'Nango dashboard/login and API keys: http://localhost:3003',
        '',
        'Next: add integrations or install the local agent sync daemon:',
        'bun run company-brain local add integrations',
        'bun run company-brain local agent-sync install',
      ].join('\n'),
      'Local URLs',
    );

    outro('Local setup is ready.');
  },
});
