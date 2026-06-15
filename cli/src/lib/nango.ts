import { existsSync } from 'node:fs';
import {
  BOOTSTRAPPED_CONNECTIONS,
  DEFAULT_INTEGRATIONS,
  DEFAULT_SYNC_SPECS,
  INTEGRATIONS,
  SYNC_SPECS,
} from '../../../nango-integrations/_scripts/lib/catalog.ts';
import { nangoIntegrationsPath } from './paths.ts';
import { ensureNangoIntegrationsAssets } from './release.ts';
import { run } from './shell.ts';

export const nangoIntegrationSpecs = INTEGRATIONS;
export const nangoDefaultIntegrationSpecs = DEFAULT_INTEGRATIONS;
export const nangoSyncSpecs = SYNC_SPECS;
export const nangoDefaultSyncSpecs = DEFAULT_SYNC_SPECS;

type NangoCommandOptions = {
  env?: Record<string, string | undefined>;
  verbose?: boolean;
};

export async function bootstrapNangoIntegrations(
  integrationIds: string[],
  options: NangoCommandOptions = {},
): Promise<void> {
  await ensureNangoIntegrationsAssets();
  await ensureNangoIntegrationDependencies(options.verbose);
  const selectionArgs = selectedArgs(integrationIds);

  await run(
    ['bun', 'run', 'bootstrap:integrations', 'dev', '--update-existing', ...selectionArgs],
    {
      cwd: nangoIntegrationsPath,
      env: packagedEnv(options.env),
      verbose: options.verbose,
    },
  );

  const connectionIntegrationIds = bootstrappedConnectionIntegrationIds(integrationIds);
  if (connectionIntegrationIds.length === 0) {
    return;
  }

  await run(
    ['bun', 'run', 'bootstrap:connections', 'dev', ...selectedArgs(connectionIntegrationIds)],
    {
      cwd: nangoIntegrationsPath,
      env: packagedEnv(options.env),
      verbose: options.verbose,
    },
  );
}

export async function checkNangoConnections(
  integrationIds: string[],
  options: NangoCommandOptions = {},
): Promise<void> {
  await ensureNangoIntegrationsAssets();
  await ensureNangoIntegrationDependencies(options.verbose);
  await run(['bun', 'run', 'check:connections', 'dev', ...selectedArgs(integrationIds)], {
    cwd: nangoIntegrationsPath,
    env: packagedEnv(options.env),
    verbose: options.verbose,
  });
}

export async function deployNangoSyncs(
  integrationIds: string[],
  options: NangoCommandOptions = {},
): Promise<void> {
  await ensureNangoIntegrationsAssets();
  await ensureNangoIntegrationDependencies(options.verbose);
  await run(
    [
      'bun',
      'run',
      'deploy',
      'dev',
      ...selectedArgs(integrationIds),
      '--auto-confirm',
      '--no-interactive',
      '--no-dependency-update',
    ],
    {
      cwd: nangoIntegrationsPath,
      env: packagedEnv(options.env),
      verbose: options.verbose,
    },
  );
}

export function bootstrappedConnectionIntegrationIds(integrationIds: string[]): string[] {
  const selectedIds = new Set(integrationIds);
  const connectionIntegrationIds = BOOTSTRAPPED_CONNECTIONS.filter((connection) =>
    selectedIds.has(connection.integrationId),
  ).map((connection) => connection.integrationId);

  return [...new Set(connectionIntegrationIds)];
}

function selectedArgs(integrationIds: string[]): string[] {
  return integrationIds.length > 0 ? ['--only', integrationIds.join(',')] : [];
}

function packagedEnv(env: Record<string, string | undefined> | undefined) {
  return {
    ...env,
    COMPANY_BRAIN_PACKAGED_INTEGRATIONS: 'true',
  };
}

async function ensureNangoIntegrationDependencies(verbose: boolean | undefined): Promise<void> {
  if (existsSync(`${nangoIntegrationsPath}/node_modules/.bin/nango`)) {
    return;
  }

  const installArgs = existsSync(`${nangoIntegrationsPath}/bun.lock`)
    ? ['bun', 'install', '--frozen-lockfile']
    : ['bun', 'install'];
  await run(installArgs, { cwd: nangoIntegrationsPath, verbose });
}
