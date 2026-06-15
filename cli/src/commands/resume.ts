import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { continueAwsDeployment } from '../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { startLocalStack, verifyLocalPrerequisites } from '../lib/docker.ts';
import { isNonInteractive } from '../lib/interaction.ts';
import { ensureRootEnv } from '../lib/local-env.ts';
import { ensureLocalNangoApiKey } from '../lib/nango-api-key.ts';
import { ensureNangoEnvBase } from '../lib/nango-env.ts';
import { ensureReleaseAssets } from '../lib/release.ts';
import { rejectOptionsForTarget, resolveCommandTarget, targetOptions } from '../lib/target.ts';

export const command = defineCommand('resume', {
  description: 'Resume setup for the selected target.',
  options: {
    ...targetOptions,
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);
    rejectOptionsForTarget(target, options, { yes: 'cloud' });

    if (target === 'local') {
      await resumeLocal({
        nonInteractive,
        verbose: Boolean(rootOptions.verbose),
        print,
      });
      return;
    }

    await resumeCloud({
      yes: options.yes,
      nonInteractive,
      print,
    });
  },
});

async function resumeLocal(options: {
  nonInteractive: boolean;
  verbose: boolean;
  print: { success: (message: string) => void; warn: (message: string) => void };
}): Promise<void> {
  intro('Company Brain local resume');

  const release = await ensureReleaseAssets();
  await ensureRootEnv({ release: release.manifest });
  await ensureNangoEnvBase();

  const issues = await verifyLocalPrerequisites();
  if (issues.length > 0) {
    for (const issue of issues) {
      options.print.warn(issue);
    }
    outro('Fix the prerequisites above, then run `company-brain resume --target local` again.');
    return;
  }

  await startLocalStack(options.verbose);
  options.print.success('Local Docker stack is healthy.');
  await ensureLocalNangoApiKey(options.nonInteractive, options.print);

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

async function resumeCloud(options: {
  yes?: boolean;
  nonInteractive: boolean;
  print: Parameters<typeof continueAwsDeployment>[0]['print'];
}): Promise<void> {
  intro('Company Brain cloud resume');

  const context = {
    yes: Boolean(options.yes),
    nonInteractive: options.nonInteractive,
  };
  const prerequisites = await verifyAwsPrerequisites(context);
  const config = {
    ...(await requireAwsConfig()),
    awsProfile: prerequisites.awsProfile,
    terraformCommand: prerequisites.terraformCommand,
  };
  if (config.awsAccountId !== prerequisites.accountId) {
    throw new Error(
      `Saved cloud config points at AWS account ${config.awsAccountId}, but current credentials are for ${prerequisites.accountId}.`,
    );
  }
  await writeAwsConfig(config);
  await continueAwsDeployment({
    config: withAwsCredentials(config, prerequisites),
    context,
    print: options.print,
  });

  outro('Cloud resume flow finished.');
}
