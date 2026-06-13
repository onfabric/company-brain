import {
  INTEGRATIONS,
  REQUIRED_CONNECTIONS,
  SYNC_SPECS,
} from '../../../nango-integrations/_scripts/nango-resources.ts';
import { nangoIntegrationsPath } from './paths.ts';
import { run } from './shell.ts';

export const nangoIntegrationSpecs = INTEGRATIONS;
export const nangoRequiredConnectionSpecs = REQUIRED_CONNECTIONS;
export const nangoSyncSpecs = SYNC_SPECS;

export async function bootstrapNangoIntegrations(
  integrationIds: string[],
  verbose = false,
): Promise<void> {
  const selectionArgs = integrationIds.length > 0 ? ['--only', integrationIds.join(',')] : [];

  await run(
    ['bun', 'run', 'bootstrap:integrations', 'dev', '--update-existing', ...selectionArgs],
    {
      cwd: nangoIntegrationsPath,
      verbose,
    },
  );
  await run(['bun', 'run', 'bootstrap:connections', 'dev', ...selectionArgs], {
    cwd: nangoIntegrationsPath,
    verbose,
  });
}

export async function checkNangoConnections(
  integrationIds: string[],
  verbose = false,
): Promise<void> {
  await run(['bun', 'run', 'check:connections', 'dev', '--only', integrationIds.join(',')], {
    cwd: nangoIntegrationsPath,
    verbose,
  });
}

export async function deployNangoSyncs(integrationIds: string[], verbose = false): Promise<void> {
  await run(
    [
      'bun',
      'run',
      'deploy',
      'dev',
      '--only',
      integrationIds.join(','),
      '--auto-confirm',
      '--no-interactive',
      '--no-dependency-update',
    ],
    {
      cwd: nangoIntegrationsPath,
      verbose,
    },
  );
}
