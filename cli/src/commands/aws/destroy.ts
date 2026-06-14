import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { requireAwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { withAwsCredentials } from '../../lib/aws-credentials.ts';
import {
  destroyAwsDeployment,
  manualDnsCleanupMessage,
  summarizeAwsDestroy,
} from '../../lib/aws-destroy.ts';
import { verifyAwsDestroyPrerequisites } from '../../lib/aws-tools.ts';
import { awsDestroyPhrase, confirmDestructiveAction } from '../../lib/destroy-confirmation.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('aws destroy', {
  description: 'Destroy the AWS deployment and remove Terraform state for a clean setup rerun.',
  options: {},
  handler: async ({ rootOptions, print }) => {
    intro('Company Brain AWS destroy');

    const context = { nonInteractive: isNonInteractive(rootOptions.nonInteractive) };
    const prerequisites = await verifyAwsDestroyPrerequisites(context);
    const config = {
      ...(await requireAwsConfig()),
      awsProfile: prerequisites.awsProfile,
      terraformCommand: prerequisites.terraformCommand,
    };
    await writeAwsConfig(config);

    const runtimeConfig = withAwsCredentials(config, prerequisites);
    const phrase = awsDestroyPhrase(config.environment, prerequisites.accountId);
    note(summarizeAwsDestroy(runtimeConfig, prerequisites.accountId, phrase), 'Destructive action');

    await confirmDestructiveAction({
      expected: phrase,
      label: `AWS Company Brain ${config.environment}`,
      nonInteractive: context.nonInteractive,
    });

    await destroyAwsDeployment({
      accountId: prerequisites.accountId,
      config: runtimeConfig,
      context,
      print,
    });

    print.success(
      'AWS Company Brain resources, backups, state, and local AWS config were removed.',
    );
    const dnsCleanupMessage = manualDnsCleanupMessage(runtimeConfig);
    if (dnsCleanupMessage) {
      note(dnsCleanupMessage, 'Manual DNS cleanup');
    }

    outro(
      dnsCleanupMessage
        ? 'AWS destroy finished. Delete the DNS records above from your DNS provider.'
        : 'AWS destroy finished.',
    );
  },
});
