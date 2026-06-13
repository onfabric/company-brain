import { existsSync } from 'node:fs';
import { defineCommand } from '@parshjs/core';
import { composeStatus, verifyLocalPrerequisites } from '../../lib/docker.ts';
import { endpointOk } from '../../lib/http.ts';
import { readLocalConfig } from '../../lib/local-config.ts';
import { readNangoEnv } from '../../lib/nango-env.ts';
import { localConfigPath, nangoEnvPath, rootEnvPath } from '../../lib/paths.ts';

export const command = defineCommand('local doctor', {
  description: 'Check local Company Brain setup health.',
  options: {},
  handler: async ({ print }) => {
    report(print.info, existsSync(rootEnvPath), '.env exists');
    report(print.info, existsSync(nangoEnvPath), 'nango-integrations/.env exists');

    const issues = await verifyLocalPrerequisites();
    report(print.info, issues.length === 0, 'Docker and submodule prerequisites');
    for (const issue of issues) {
      print.warn(issue);
    }

    try {
      const statuses = await composeStatus();
      report(print.info, statuses.length > 0, 'Docker Compose services exist');
      for (const status of statuses) {
        print.dim(`${status.name}: ${status.status}`);
      }
    } catch (error) {
      print.warn(error instanceof Error ? error.message : String(error));
    }

    report(print.info, await endpointOk('http://localhost:3003/health'), 'Nango health endpoint');
    report(print.info, await endpointOk('http://localhost:3009/'), 'Nango Connect UI endpoint');
    report(print.info, await endpointOk('http://localhost:3010/health'), 'Brain health endpoint');

    const nangoEnv = await readNangoEnv();
    report(print.info, Boolean(nangoEnv.NANGO_SECRET_KEY_DEV), 'Nango dev API key configured');

    const localConfig = await readLocalConfig();
    report(print.info, existsSync(localConfigPath), 'Local integration config exists');
    if (localConfig.installedIntegrationIds.length > 0) {
      print.info(`Installed integrations: ${localConfig.installedIntegrationIds.join(', ')}`);
    } else {
      print.warn('No integrations selected yet. Run `bun run company-brain nango integrations`.');
    }

    if (localConfig.selectedIntegrationIds.length > 0) {
      print.info(`Deployed sync integrations: ${localConfig.selectedIntegrationIds.join(', ')}`);
    } else {
      print.warn(
        'No syncs deployed yet. Run `bun run company-brain nango syncs` after connecting data sources.',
      );
    }
  },
});

function report(log: (message: string) => void, ok: boolean, label: string): void {
  log(`${ok ? 'ok' : 'missing'} - ${label}`);
}
