import { rm } from 'node:fs/promises';
import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { requireAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import {
  destroyAwsDeployment,
  manualDnsCleanupMessage,
  summarizeAwsDestroy,
} from '../lib/aws-destroy.ts';
import { verifyAwsDestroyPrerequisites } from '../lib/aws-tools.ts';
import {
  awsDestroyPhrase,
  confirmDestructiveAction,
  localDestroyPhrase,
} from '../lib/destroy-confirmation.ts';
import { destroyLocalStack, verifyDockerDaemon } from '../lib/docker.ts';
import { isNonInteractive } from '../lib/interaction.ts';
import { localConfigPath, nangoEnvPath, rootEnvPath } from '../lib/paths.ts';
import { resolveCommandTarget, targetOptions } from '../lib/target.ts';

const LOCAL_DESTROY_FILES = [rootEnvPath, nangoEnvPath, localConfigPath] as const;

export const command = defineCommand('destroy', {
  description: 'Destroy local or cloud Company Brain resources.',
  options: targetOptions,
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);

    if (target === 'local') {
      await destroyLocal({ nonInteractive, verbose: Boolean(rootOptions.verbose), print });
      return;
    }

    await destroyCloud({ nonInteractive, print });
  },
});

async function destroyLocal(options: {
  nonInteractive: boolean;
  verbose: boolean;
  print: { success: (message: string) => void };
}): Promise<void> {
  intro('Company Brain local destroy');

  const phrase = localDestroyPhrase();
  note(
    [
      'This permanently deletes the local Company Brain Docker containers, volumes, and generated configuration.',
      'Local Postgres, Elasticsearch, Nango, Brain, and Caddy data will be removed.',
      '',
      'Docker objects:',
      '- containers: postgres-db, nango-server, nango-orchestrator, nango-persist, nango-jobs, nango-redis, nango-elasticsearch, db-prepare, brain, dozzle',
      '- volumes: postgres-data, elasticsearch-data, nango-integrations',
      '- images: company-brain/nango:local, company-brain/brain:local',
      '',
      'Generated files:',
      ...LOCAL_DESTROY_FILES.map((path) => `- ${path}`),
      '',
      `Confirmation phrase: ${phrase}`,
    ].join('\n'),
    'Destructive action',
  );

  await confirmDestructiveAction({
    expected: phrase,
    label: 'local Company Brain',
    nonInteractive: options.nonInteractive,
  });

  await verifyDockerDaemon();
  await destroyLocalStack(options.verbose);
  await removeGeneratedFiles();

  options.print.success('Local Company Brain Docker resources and generated files were removed.');
  outro('Local destroy finished.');
}

async function destroyCloud(options: {
  nonInteractive: boolean;
  print: { success: (message: string) => void; warn: (message: string) => void };
}): Promise<void> {
  intro('Company Brain cloud destroy');

  const context = { nonInteractive: options.nonInteractive };
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
    label: `hosted Company Brain ${config.environment}`,
    nonInteractive: context.nonInteractive,
  });

  await destroyAwsDeployment({
    accountId: prerequisites.accountId,
    config: runtimeConfig,
    context,
    print: options.print,
  });

  options.print.success(
    'Hosted Company Brain resources, backups, state, and local deploy config were removed.',
  );
  const dnsCleanupMessage = manualDnsCleanupMessage(runtimeConfig);
  if (dnsCleanupMessage) {
    note(dnsCleanupMessage, 'Manual DNS cleanup');
  }

  outro(
    dnsCleanupMessage
      ? 'Deployment destroy finished. Delete the DNS records above from your DNS provider.'
      : 'Deployment destroy finished.',
  );
}

async function removeGeneratedFiles(): Promise<void> {
  for (const path of LOCAL_DESTROY_FILES) {
    await rm(path, { force: true });
  }
}
