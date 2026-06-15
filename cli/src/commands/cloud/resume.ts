import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { withAwsCredentials } from '../../lib/aws-credentials.ts';
import { continueAwsDeployment } from '../../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../../lib/aws-tools.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('cloud resume', {
  description: 'Resume a paused cloud after DNS or HTTPS setup.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain cloud resume');

    const context = {
      yes: Boolean(options.yes),
      nonInteractive: isNonInteractive(rootOptions['non-interactive']),
    };
    const prerequisites = await verifyAwsPrerequisites(context);
    const config = {
      ...(await requireAwsConfig()),
      awsProfile: prerequisites.awsProfile,
      terraformCommand: prerequisites.terraformCommand,
    };
    await writeAwsConfig(config);
    await continueAwsDeployment({
      config: withAwsCredentials(config, prerequisites),
      context,
      print,
    });

    outro('Cloud resume flow finished.');
  },
});
