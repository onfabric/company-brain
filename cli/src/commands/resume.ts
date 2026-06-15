import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { continueAwsDeployment } from '../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { isNonInteractive } from '../lib/interaction.ts';

export const command = defineCommand('resume', {
  description: 'Resume hosted Company Brain setup or deployment.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

    intro('Company Brain cloud resume');

    const context = {
      yes: Boolean(options.yes),
      nonInteractive,
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
      print,
    });

    outro('Cloud resume flow finished.');
  },
});
