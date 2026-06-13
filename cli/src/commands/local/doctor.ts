import { existsSync } from 'node:fs';
import { styleText } from 'node:util';
import { intro, log, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import {
  type ComposeService,
  composeServices,
  isComposeServiceReady,
  verifyLocalPrerequisites,
} from '../../lib/docker.ts';
import { endpointOk } from '../../lib/http.ts';
import { readLocalConfig } from '../../lib/local-config.ts';
import { readNangoEnv } from '../../lib/nango-env.ts';
import { localConfigPath, nangoEnvPath, rootEnvPath } from '../../lib/paths.ts';

type DoctorCheck = {
  ok: boolean;
  label: string;
  detail?: string;
};

export const command = defineCommand('local doctor', {
  description: 'Check local Company Brain setup health.',
  options: {},
  handler: async ({ rootOptions }) => {
    intro('Company Brain local check');

    const configChecks: DoctorCheck[] = [
      {
        ok: existsSync(rootEnvPath),
        label: 'Root env file',
        detail: existsSync(rootEnvPath) ? '.env' : 'Run `bun run company-brain local setup`.',
      },
      {
        ok: existsSync(nangoEnvPath),
        label: 'Nango env file',
        detail: existsSync(nangoEnvPath)
          ? 'nango-integrations/.env'
          : 'Run `bun run company-brain local setup`.',
      },
    ];
    renderSection('Config', configChecks);

    const issues = await verifyLocalPrerequisites();
    const serviceChecks: DoctorCheck[] = [
      {
        ok: issues.length === 0,
        label: 'Docker and submodule prerequisites',
        detail: issues.length === 0 ? undefined : issues.join('\n'),
      },
    ];

    try {
      const services = await composeServices();
      const unavailable = services.filter((service) => !isComposeServiceReady(service));
      serviceChecks.push({
        ok: services.length > 0 && unavailable.length === 0,
        label: 'Docker Compose services',
        detail: formatComposeSummary(services, Boolean(rootOptions.verbose)),
      });
    } catch (error) {
      serviceChecks.push({
        ok: false,
        label: 'Docker Compose services',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    renderSection('Services', serviceChecks);

    const endpointChecks: DoctorCheck[] = [
      {
        ok: await endpointOk('http://localhost:3003/health'),
        label: 'Nango API',
        detail: 'http://localhost:3003/health',
      },
      {
        ok: await endpointOk('http://localhost:3003/'),
        label: 'Nango dashboard',
        detail: 'http://localhost:3003',
      },
      {
        ok: await endpointOk('http://localhost:3010/health'),
        label: 'Brain API',
        detail: 'http://localhost:3010/health',
      },
    ];
    renderSection('Endpoints', endpointChecks);

    const nangoEnv = await readNangoEnv();
    const localConfig = await readLocalConfig();
    const nangoChecks: DoctorCheck[] = [
      {
        ok: Boolean(nangoEnv.NANGO_SECRET_KEY_DEV),
        label: 'Nango dev API key',
        detail: nangoEnv.NANGO_SECRET_KEY_DEV
          ? 'Saved in nango-integrations/.env'
          : 'Copy it from http://localhost:3003/dev/environment-settings#api-keys, then run `bun run company-brain nango integrations`.',
      },
      {
        ok: existsSync(localConfigPath),
        label: 'Local integration config',
        detail: existsSync(localConfigPath)
          ? '.company-brain.local.json'
          : 'Created after integration setup.',
      },
      {
        ok: localConfig.installedIntegrationIds.length > 0,
        label: 'Installed integrations',
        detail:
          localConfig.installedIntegrationIds.length > 0
            ? localConfig.installedIntegrationIds.join(', ')
            : 'Run `bun run company-brain nango integrations`.',
      },
      {
        ok: localConfig.selectedIntegrationIds.length > 0,
        label: 'Deployed sync integrations',
        detail:
          localConfig.selectedIntegrationIds.length > 0
            ? localConfig.selectedIntegrationIds.join(', ')
            : 'Deploy after connecting sources, or rerun `bun run company-brain nango integrations`.',
      },
    ];
    renderSection('Nango setup', nangoChecks);

    const failed = [...configChecks, ...serviceChecks, ...endpointChecks, ...nangoChecks].filter(
      (check) => !check.ok,
    );
    outro(
      failed.length === 0
        ? styleText('green', 'Local setup looks healthy.')
        : styleText('yellow', formatAttentionOutro(failed)),
    );
  },
});

function renderSection(title: string, checks: DoctorCheck[]): void {
  log.info(styleText('blue', title), { spacing: 0 });
  for (const check of checks) {
    log.message(formatCheck(check), {
      symbol: check.ok ? styleText('green', '◆') : styleText('yellow', '▲'),
      spacing: 0,
    });
  }
}

function formatCheck(check: DoctorCheck): string {
  const color = check.ok ? 'green' : 'yellow';
  const lines = [`${check.ok ? 'Ready' : 'Needs attention'}: ${check.label}`];

  if (check.detail) {
    lines.push(...check.detail.split('\n').map((line) => `   ${line}`));
  }

  return lines.map((line) => styleText(color, line)).join('\n');
}

function formatComposeSummary(services: ComposeService[], verbose: boolean): string {
  if (services.length === 0) {
    return 'No services found. Run `bun run company-brain local setup`.';
  }

  const ready = services.filter(isComposeServiceReady);
  const unavailable = services.filter((service) => !isComposeServiceReady(service));

  if (unavailable.length > 0) {
    return [
      `${ready.length}/${services.length} services ready`,
      ...unavailable.map(formatServiceStatus),
      'Run `docker compose ps` for full service details.',
    ].join('\n');
  }

  const completed = services.filter(
    (service) => service.state === 'exited' && service.exitCode === '0',
  );
  const summary = [`${services.length} services ready`];

  if (completed.length > 0) {
    summary.push(`${completed.map((service) => serviceName(service.name)).join(', ')} completed`);
  }

  if (verbose) {
    summary.push(...services.map(formatServiceStatus));
  }

  return summary.join('\n');
}

function formatServiceStatus(service: ComposeService): string {
  const status = service.status || [service.state, service.health].filter(Boolean).join(' ');
  return `${serviceName(service.name)}: ${status}`;
}

function serviceName(name: string): string {
  return name.replace(/^company-brain-/, '').replace(/-1$/, '');
}

function formatAttentionOutro(failed: DoctorCheck[]): string {
  const label = failed.length === 1 ? 'item needs' : 'items need';
  return `${failed.length} ${label} attention. The next step is shown beside each one.`;
}
