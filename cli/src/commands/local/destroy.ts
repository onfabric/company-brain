import { rm } from 'node:fs/promises';
import { intro, note, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { confirmDestructiveAction, localDestroyPhrase } from '../../lib/destroy-confirmation.ts';
import { destroyLocalStack, verifyDockerDaemon } from '../../lib/docker.ts';
import { isNonInteractive } from '../../lib/interaction.ts';
import { localConfigPath, nangoEnvPath, rootEnvPath } from '../../lib/paths.ts';

const LOCAL_DESTROY_FILES = [rootEnvPath, nangoEnvPath, localConfigPath] as const;

export const command = defineCommand('local destroy', {
  description: 'Destroy the local Docker stack, volumes, images, and generated local config.',
  options: {},
  handler: async ({ rootOptions, print }) => {
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
      nonInteractive: isNonInteractive(rootOptions['non-interactive']),
    });

    await verifyDockerDaemon();
    await destroyLocalStack(Boolean(rootOptions.verbose));
    await removeGeneratedFiles();

    print.success('Local Company Brain Docker resources and generated files were removed.');
    outro('Local destroy finished.');
  },
});

async function removeGeneratedFiles(): Promise<void> {
  for (const path of LOCAL_DESTROY_FILES) {
    await rm(path, { force: true });
  }
}
