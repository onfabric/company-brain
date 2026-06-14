import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { readAwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { continueAwsDeployment, provisionAwsInfrastructure } from '../../lib/aws-deployment.ts';
import { collectAwsConfig } from '../../lib/aws-prompts.ts';
import { verifyAwsPrerequisites } from '../../lib/aws-tools.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('aws setup', {
  description: 'Deploy Company Brain directly to AWS from this local checkout.',
  options: {
    force: {
      schema: z.boolean().optional(),
      description: 'Prompt for deployment configuration even when AWS config exists.',
    },
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain AWS setup');

    const nonInteractive = isNonInteractive(rootOptions.nonInteractive);
    const context = { yes: Boolean(options.yes), nonInteractive };
    const existing = await readAwsConfig();
    const prerequisites = await verifyAwsPrerequisites(context);
    note(
      [
        `AWS account: ${prerequisites.accountId}`,
        `AWS identity: ${prerequisites.arn}`,
        `AWS profile: ${prerequisites.awsProfile ?? 'default credential chain'}`,
      ].join('\n'),
      'AWS login',
    );

    let config = await collectAwsConfig({
      existing,
      detectedAwsProfile: prerequisites.awsProfile,
      force: options.force,
      nonInteractive,
    });
    config = { ...config, terraformCommand: prerequisites.terraformCommand };
    await writeAwsConfig(config);

    config = await provisionAwsInfrastructure(config, context, print);
    await continueAwsDeployment({ config, context, print });

    outro('AWS setup flow finished.');
  },
});
