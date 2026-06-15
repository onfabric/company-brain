import { intro, isCancel, note, outro, text } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { startLocalStack, verifyLocalPrerequisites } from '../../lib/docker.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { ensureRootEnv, readRootEnv } from '../../lib/local-env.ts';
import { ensureLocalNangoApiKey } from '../../lib/nango-api-key.ts';
import { ensureNangoEnvBase } from '../../lib/nango-env.ts';

export const command = defineCommand('local setup', {
  description: 'Generate local configuration and start the local stack.',
  options: {
    force: {
      schema: z.boolean().optional(),
      description: 'Regenerate local env files even when they already exist.',
    },
    'skip-start': {
      schema: z.boolean().optional(),
      description: 'Only write local configuration without starting Docker Compose.',
    },
    'workspace-domain': {
      schema: z.string().optional(),
      description: 'Google Workspace domain allowed to sign in to the brain.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain local setup');

    const workspaceDomain =
      options['workspace-domain'] ??
      (await promptWorkspaceDomainIfMissing(isNonInteractive(rootOptions['non-interactive'])));
    await ensureRootEnv({ force: options.force, workspaceDomain });
    await ensureNangoEnvBase(options.force);

    print.success('Local env files are ready.');

    const issues = await verifyLocalPrerequisites();
    if (issues.length > 0) {
      for (const issue of issues) {
        print.warn(issue);
      }
      outro('Fix the prerequisites above, then run `bun run company-brain local setup` again.');
      return;
    }

    if (!options['skip-start']) {
      await startLocalStack(Boolean(rootOptions.verbose));
      print.success('Local Docker stack is healthy.');
      await ensureLocalNangoApiKey(isNonInteractive(rootOptions['non-interactive']), print);
    }

    note(
      [
        'Brain dashboard: http://localhost:3010/',
        'Nango dashboard/login and API keys: http://localhost:3003',
        '',
        'Next: add integrations or install the local agent sync schedule:',
        'bun run company-brain local add integrations',
        'bun run company-brain local agent-sync install',
      ].join('\n'),
      'Local URLs',
    );

    outro('Local setup is ready.');
  },
});

async function promptWorkspaceDomainIfMissing(
  nonInteractive: boolean,
): Promise<string | undefined> {
  const existing = await readRootEnv();
  if (existing.WORKSPACE_DOMAIN) {
    return undefined;
  }

  return await promptWorkspaceDomain('example.com', nonInteractive);
}

async function promptWorkspaceDomain(
  defaultValue: string,
  nonInteractive: boolean,
): Promise<string> {
  if (nonInteractive) {
    return defaultValue;
  }

  const answer = await text({
    message: 'Workspace domain for local Google sign-in checks',
    placeholder: defaultValue,
    defaultValue,
    validate: validateRequired,
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  return answer;
}

function validateRequired(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Required';
  }

  return undefined;
}
