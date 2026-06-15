import { intro, isCancel, note, outro, text } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import {
  ALLOWED_EMAILS_PLACEHOLDER,
  allowedEmailsToRegex,
  validateAllowedEmailsInput,
} from '../../lib/allowed-emails.ts';
import { startLocalStack, verifyLocalPrerequisites } from '../../lib/docker.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { ensureRootEnv, readRootEnv } from '../../lib/local-env.ts';
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
    'allowed-emails': {
      schema: z.string().optional(),
      description:
        'Comma-separated emails allowed to sign in; use *@domain for a whole workspace. Empty allows any.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain local setup');

    const allowedEmails =
      options['allowed-emails'] ??
      (await promptAllowedEmailsIfMissing(isNonInteractive(rootOptions['non-interactive'])));
    await ensureRootEnv({
      force: options.force,
      allowedEmailsRegex:
        allowedEmails === undefined ? undefined : allowedEmailsToRegex(allowedEmails),
    });
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
    }

    note(
      [
        'Brain dashboard: http://localhost:3010/',
        'Nango dashboard/login and API keys: http://localhost:3003',
        '',
        'Next: create/sign in to the local Nango dashboard, copy the dev API key, then run:',
        'bun run company-brain local add integrations',
      ].join('\n'),
      'Local URLs',
    );

    outro('Local setup is ready.');
  },
});

async function promptAllowedEmailsIfMissing(nonInteractive: boolean): Promise<string | undefined> {
  const existing = await readRootEnv();
  if (existing.BRAIN_ALLOWED_EMAILS_REGEX) {
    return undefined;
  }

  if (nonInteractive) {
    return '';
  }

  const answer = await text({
    message: 'Emails allowed to sign in (comma-separated, *@domain for a whole workspace)',
    placeholder: `${ALLOWED_EMAILS_PLACEHOLDER} — leave empty to allow any`,
    validate: validateAllowedEmailsInput,
  });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  return answer ?? '';
}
