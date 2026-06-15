import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { deployAwsApplication } from '../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { isNonInteractive } from '../lib/interaction.ts';
import { resolveCommandTarget, targetOptions } from '../lib/target.ts';

export const command = defineCommand('update', {
  description: 'Rebuild images and update an existing cloud deployment.',
  options: {
    ...targetOptions,
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);
    if (target !== 'cloud') {
      throw new Error(
        'Update is only available for cloud. Run `company-brain update --target cloud`.',
      );
    }

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
