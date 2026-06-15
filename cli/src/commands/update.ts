import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { type AwsConfig, requireAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { deployAwsApplication, provisionAwsInfrastructure } from '../lib/aws-deployment.ts';
import { verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { isNonInteractive } from '../lib/interaction.ts';
import { ensureReleaseAssets } from '../lib/release.ts';

export const command = defineCommand('update', {
  description: 'Update an existing hosted Company Brain deployment.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating commands without per-command approval.',
    },
    version: {
      schema: z.string().optional(),
      description: 'Deploy an exact Company Brain release version, such as v0.4.0.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

    intro('Company Brain cloud update');
    if (options.version) {
      process.env.COMPANY_BRAIN_RELEASE_VERSION = options.version;
    }

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
    if (config.awsAccountId !== prerequisites.accountId) {
      throw new Error(
        `Saved cloud config points at AWS account ${config.awsAccountId}, but current credentials are for ${prerequisites.accountId}.`,
      );
    }

    const release = await ensureReleaseAssets();
    await writeAwsConfig(config);
    let current: AwsConfig = config;
    if ((config.infraVersion ?? 1) !== release.manifest.deployment.infraVersion) {
      current = await provisionAwsInfrastructure(
        withAwsCredentials(current, prerequisites),
        context,
        print,
      );
    }
    await deployAwsApplication(withAwsCredentials(current, prerequisites), context, print);

    outro('Cloud update finished.');
  },
});
