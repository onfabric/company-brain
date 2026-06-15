import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { readAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { continueAwsDeployment, provisionAwsInfrastructure } from '../lib/aws-deployment.ts';
import { collectAwsConfig } from '../lib/aws-prompts.ts';
import { type AwsPrerequisites, verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { isNonInteractive } from '../lib/interaction.ts';

export const command = defineCommand('setup', {
  description: 'Provision and deploy hosted Company Brain on AWS.',
  options: {
    force: {
      schema: z.boolean().optional(),
      description: 'Regenerate or prompt for setup configuration.',
    },
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud mutating commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

    intro('Company Brain cloud setup');

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
      awsAccountId: prerequisites.accountId,
      force: options.force,
      nonInteractive,
    });
    if (config.awsAccountId !== prerequisites.accountId) {
      throw new Error(
        `Saved cloud config points at AWS account ${config.awsAccountId}, but current credentials are for ${prerequisites.accountId}.`,
      );
    }
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
