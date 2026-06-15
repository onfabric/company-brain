import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { deployAwsApplication } from '../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { isNonInteractive } from '../lib/interaction.ts';

export const command = defineCommand('update', {
  description: 'Update an existing hosted Company Brain deployment.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

    intro('Company Brain cloud update');

    const context = {
      yes: Boolean(options.yes),
      nonInteractive,
    };
    const prerequisites = await verifyAwsPrerequisites(context);
    const config = {
      ...(await requireAwsConfig()),
      awsProfile: prerequisites.awsProfile,
      terraformCommand: prerequisites.terraformCommand,
      appDeployedAt: undefined,
    };
    await writeAwsConfig(config);
    await deployAwsApplication(withAwsCredentials(config, prerequisites), context, print);

    outro('Cloud update finished.');
  },
});
