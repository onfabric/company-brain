import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { deployAwsApplication } from '../../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../../lib/aws-tools.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('aws deploy', {
  description: 'Rebuild images and redeploy the app to an existing AWS deployment.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain AWS deploy');

    const context = {
      yes: Boolean(options.yes),
      nonInteractive: isNonInteractive(rootOptions.nonInteractive),
    };
    const prerequisites = await verifyAwsPrerequisites(context);
    const config = {
      ...(await requireAwsConfig()),
      terraformCommand: prerequisites.terraformCommand,
      appDeployedAt: undefined,
    };
    await writeAwsConfig(config);
    await deployAwsApplication(config, context, print);

    outro('AWS deploy finished.');
  },
});
