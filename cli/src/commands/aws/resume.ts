import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { continueAwsDeployment } from '../../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../../lib/aws-tools.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('aws resume', {
  description: 'Resume a paused AWS deployment after DNS, Nango, or OAuth setup.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain AWS resume');

    const context = {
      yes: Boolean(options.yes),
      nonInteractive: isNonInteractive(rootOptions.nonInteractive),
    };
    const prerequisites = await verifyAwsPrerequisites(context);
    const config = {
      ...(await requireAwsConfig()),
      terraformCommand: prerequisites.terraformCommand,
    };
    await writeAwsConfig(config);
    await continueAwsDeployment({ config, context, print });

    outro('AWS resume flow finished.');
  },
});
