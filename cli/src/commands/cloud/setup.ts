import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { readAwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { withAwsCredentials } from '../../lib/aws-credentials.ts';
import { continueAwsDeployment, provisionAwsInfrastructure } from '../../lib/aws-deployment.ts';
import { collectAwsConfig } from '../../lib/aws-prompts.ts';
import { type AwsPrerequisites, verifyAwsPrerequisites } from '../../lib/aws-tools.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('cloud setup', {
  description: 'Provision the hosted Company Brain cloud on AWS.',
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
    intro('Company Brain cloud setup');

    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const context = { yes: Boolean(options.yes), nonInteractive };
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
      nonInteractive,
    });
    config = {
      ...config,
      awsProfile: prerequisites.awsProfile,
      terraformCommand: prerequisites.terraformCommand,
    };
    await writeAwsConfig(config);
    config = withAwsCredentials(config, prerequisites);

    config = await provisionAwsInfrastructure(config, context, print);
    await continueAwsDeployment({ config, context, print });

    outro('Cloud setup flow finished.');
  },
});

function formatCredentialSource(prerequisites: AwsPrerequisites): string {
  const source = prerequisites.awsProfile
    ? `current shell profile "${prerequisites.awsProfile}"`
    : 'current shell default credential chain';
  const expiration = prerequisites.awsCredentials.expiration;

  return expiration ? `${source}; exported credentials expire at ${expiration}` : source;
}
