import { intro, isCancel, note, outro, text } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import {
  ALLOWED_EMAILS_PLACEHOLDER,
  allowedEmailsToRegex,
  validateAllowedEmailsInput,
} from '../lib/allowed-emails.ts';
import { readAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { continueAwsDeployment, provisionAwsInfrastructure } from '../lib/aws-deployment.ts';
import { collectAwsConfig } from '../lib/aws-prompts.ts';
import { type AwsPrerequisites, verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { startLocalStack, verifyLocalPrerequisites } from '../lib/docker.ts';
import { isNonInteractive } from '../lib/interaction.ts';
import { ensureRootEnv, readRootEnv } from '../lib/local-env.ts';
import { ensureLocalNangoApiKey } from '../lib/nango-api-key.ts';
import { ensureNangoEnvBase } from '../lib/nango-env.ts';
import { rejectOptionsForTarget, resolveCommandTarget, targetOptions } from '../lib/target.ts';

export const command = defineCommand('setup', {
  description: 'Generate local configuration or provision the hosted cloud.',
  options: {
    ...targetOptions,
    force: {
      schema: z.boolean().optional(),
      description: 'Regenerate or prompt for setup configuration.',
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
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);
    rejectOptionsForTarget(target, options, {
      yes: 'cloud',
      'skip-start': 'local',
      'allowed-emails': 'local',
    });

    if (target === 'local') {
      await setupLocal({
        force: options.force,
        skipStart: options['skip-start'],
        allowedEmails: options['allowed-emails'],
        nonInteractive,
        verbose: Boolean(rootOptions.verbose),
        print,
      });
      return;
    }

    await setupCloud({
      force: options.force,
      yes: options.yes,
      nonInteractive,
      print,
    });
  },
});

async function setupLocal(options: {
  force?: boolean;
  skipStart?: boolean;
  allowedEmails?: string;
  nonInteractive: boolean;
  verbose: boolean;
  print: { success: (message: string) => void; warn: (message: string) => void };
}): Promise<void> {
  intro('Company Brain local setup');

  const allowedEmails =
    options.allowedEmails ?? (await promptAllowedEmailsIfMissing(options.nonInteractive));
  await ensureRootEnv({
    force: options.force,
    allowedEmailsRegex:
      allowedEmails === undefined ? undefined : allowedEmailsToRegex(allowedEmails),
  });
  await ensureNangoEnvBase(options.force);

  options.print.success('Local env files are ready.');

  const issues = await verifyLocalPrerequisites();
  if (issues.length > 0) {
    for (const issue of issues) {
      options.print.warn(issue);
    }
    outro('Fix the prerequisites above, then run `company-brain setup --target local` again.');
    return;
  }

  if (!options.skipStart) {
    await startLocalStack(options.verbose);
    options.print.success('Local Docker stack is healthy.');
    await ensureLocalNangoApiKey(options.nonInteractive, options.print);
  }

  note(
    [
      'Brain dashboard: http://localhost:3010/',
      'Nango dashboard/login and API keys: http://localhost:3003',
      '',
      'Next: add integrations or install the local agent sync schedule:',
      'company-brain add integrations --target local',
      'company-brain agent-sync install --target local',
    ].join('\n'),
    'Local URLs',
  );

  outro('Local setup is ready.');
}

async function setupCloud(options: {
  force?: boolean;
  yes?: boolean;
  nonInteractive: boolean;
  print: Parameters<typeof continueAwsDeployment>[0]['print'];
}): Promise<void> {
  intro('Company Brain cloud setup');

  const context = { yes: Boolean(options.yes), nonInteractive: options.nonInteractive };
  const existing = await readAwsConfig();
  const prerequisites = await verifyAwsPrerequisites(context);
  note(
    [
      `AWS account: ${prerequisites.accountId}`,
      `AWS identity: ${prerequisites.arn}`,
      `AWS credentials: ${formatCredentialSource(prerequisites)}`,
    ].join('\n'),
    'AWS login',
  );

  let config = await collectAwsConfig({
    existing,
    force: options.force,
    nonInteractive: options.nonInteractive,
  });
  config = {
    ...config,
    awsProfile: prerequisites.awsProfile,
    terraformCommand: prerequisites.terraformCommand,
  };
  await writeAwsConfig(config);
  config = withAwsCredentials(config, prerequisites);

  config = await provisionAwsInfrastructure(config, context, options.print);
  await continueAwsDeployment({ config, context, print: options.print });

  outro('Cloud setup flow finished.');
}

async function promptAllowedEmailsIfMissing(nonInteractive: boolean): Promise<string | undefined> {
  const existing = await readRootEnv();
  if (existing.ALLOWED_DASHBOARD_ACCOUNTS_EMAILS_REGEX) {
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

function formatCredentialSource(prerequisites: AwsPrerequisites): string {
  const source = prerequisites.awsProfile
    ? `current shell profile "${prerequisites.awsProfile}"`
    : 'current shell default credential chain';
  const expiration = prerequisites.awsCredentials.expiration;

  return expiration ? `${source}; exported credentials expire at ${expiration}` : source;
}
