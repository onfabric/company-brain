import { existsSync } from 'node:fs';
import { styleText } from 'node:util';
import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../lib/aws-config.ts';
import { withAwsCredentials } from '../lib/aws-credentials.ts';
import { dnsIssues, httpsIssues } from '../lib/aws-dns.ts';
import { verifyHostedNangoApi } from '../lib/aws-nango.ts';
import { runRemoteHealthCommand } from '../lib/aws-ssm.ts';
import { verifyAwsPrerequisites } from '../lib/aws-tools.ts';
import { DEFAULT_BRAIN_URL, isBrainApiHealthy } from '../lib/brain.ts';
import {
  type ComposeService,
  composeServices,
  isComposeServiceReady,
  verifyLocalPrerequisites,
} from '../lib/docker.ts';
import {
  type DoctorCheck,
  formatAttentionOutro,
  formatError,
  renderDoctorChecks,
  renderDoctorSection,
} from '../lib/doctor.ts';
import { endpointOk } from '../lib/http.ts';
import { isNonInteractive } from '../lib/interaction.ts';
import { readLocalConfig } from '../lib/local-config.ts';
import { readRootEnv } from '../lib/local-env.ts';
import { readNangoEnv } from '../lib/nango-env.ts';
import { localConfigPath, nangoEnvPath, rootEnvPath } from '../lib/paths.ts';
import { rejectOptionsForTarget, resolveCommandTarget, targetOptions } from '../lib/target.ts';

export const command = defineCommand('doctor', {
  description: 'Check local or cloud Company Brain setup health.',
  options: {
    ...targetOptions,
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible cloud check commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    const nonInteractive = isNonInteractive(rootOptions['non-interactive']);
    const target = await resolveCommandTarget(options.target, nonInteractive);
    rejectOptionsForTarget(target, options, { yes: 'cloud' });

    if (target === 'local') {
      await doctorLocal(Boolean(rootOptions.verbose));
      return;
    }

    await doctorCloud({
      yes: options.yes,
      nonInteractive,
      print,
    });
  },
});

async function doctorLocal(verbose: boolean): Promise<void> {
  intro('Company Brain local check');

  const configChecks: DoctorCheck[] = [
    {
      ok: existsSync(rootEnvPath),
      label: 'Root env file',
      detail: existsSync(rootEnvPath) ? '.env' : 'Run `company-brain setup --target local`.',
    },
    {
      ok: existsSync(nangoEnvPath),
      label: 'Nango env file',
      detail: existsSync(nangoEnvPath)
        ? 'nango-integrations/.env'
        : 'Run `company-brain setup --target local`.',
    },
  ];
  renderDoctorSection('Config', configChecks);

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
      detail: formatComposeSummary(services, verbose),
    });
  } catch (error) {
    serviceChecks.push({
      ok: false,
      label: 'Docker Compose services',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  renderDoctorSection('Services', serviceChecks);

  const rootEnv = await readRootEnv();
  const brainBaseUrl = rootEnv.BRAIN_PUBLIC_URL || DEFAULT_BRAIN_URL;
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
      ok: await isBrainApiHealthy(brainBaseUrl),
      label: 'Brain API',
      detail: `${brainBaseUrl}/api/health`,
    },
  ];
  renderDoctorSection('Endpoints', endpointChecks);

  const nangoEnv = await readNangoEnv();
  const localConfig = await readLocalConfig();
  const nangoChecks: DoctorCheck[] = [
    {
      ok: Boolean(nangoEnv.NANGO_SECRET_KEY_DEV),
      label: 'Nango dev API key',
      detail: nangoEnv.NANGO_SECRET_KEY_DEV
        ? 'Saved in nango-integrations/.env'
        : 'Copy it from http://localhost:3003/dev/environment-settings#api-keys, then run `company-brain resume --target local`.',
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
          : 'Run `company-brain add integrations --target local`.',
    },
    {
      ok: localConfig.selectedIntegrationIds.length > 0,
      label: 'Deployed sync integrations',
      detail:
        localConfig.selectedIntegrationIds.length > 0
          ? localConfig.selectedIntegrationIds.join(', ')
          : 'Run `company-brain add syncs --target local` after connecting sources.',
    },
  ];
  renderDoctorSection('Nango setup', nangoChecks);

  const failed = [...configChecks, ...serviceChecks, ...endpointChecks, ...nangoChecks].filter(
    (check) => !check.ok,
  );
  outro(
    failed.length === 0
      ? styleText('green', 'Local setup looks healthy.')
      : styleText('yellow', formatAttentionOutro(failed)),
  );
}

async function doctorCloud(options: {
  yes?: boolean;
  nonInteractive: boolean;
  print: { success: (message: string) => void; warn: (message: string) => void };
}): Promise<void> {
  intro('Company Brain cloud check');

  const context = {
    yes: Boolean(options.yes),
    nonInteractive: options.nonInteractive,
  };
  const prerequisites = await verifyAwsPrerequisites(context);
  const config = {
    ...(await requireAwsConfig()),
    awsProfile: prerequisites.awsProfile,
    terraformCommand: prerequisites.terraformCommand,
  };
  if (config.awsAccountId !== prerequisites.accountId) {
    throw new Error(
      `Saved cloud config points at AWS account ${config.awsAccountId}, but current credentials are for ${prerequisites.accountId}.`,
    );
  }
  await writeAwsConfig(config);
  const runtimeConfig = withAwsCredentials(config, prerequisites);

  const checks: DoctorCheck[] = [
    { label: 'AWS login', ok: true, detail: `${prerequisites.accountId} (${prerequisites.arn})` },
    {
      label: 'Terraform outputs',
      ok: Boolean(config.outputs),
      detail: config.outputs
        ? config.outputs.instanceId
        : 'Run `company-brain setup --target cloud`.',
    },
  ];

  if (runtimeConfig.outputs) {
    const dns = await dnsIssues(runtimeConfig);
    checks.push({ label: 'DNS records', ok: dns.length === 0, detail: dns.join('\n') });

    const https = await httpsIssues(runtimeConfig);
    checks.push({ label: 'HTTPS endpoints', ok: https.length === 0, detail: https.join('\n') });

    checks.push(await remoteComposeCheck(runtimeConfig, context));
  }

  checks.push(await nangoApiCheck(runtimeConfig));
  renderDoctorChecks(checks);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    options.print.warn(`${failed.length} cloud check(s) need attention.`);
  } else {
    options.print.success('Hosted deployment looks healthy.');
  }

  outro('Cloud doctor finished.');
}

async function remoteComposeCheck(
  config: Awaited<ReturnType<typeof requireAwsConfig>>,
  context: { yes?: boolean; nonInteractive?: boolean },
): Promise<DoctorCheck> {
  try {
    const output = await runRemoteHealthCommand(config, context);
    const unhealthy = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((line) => !composeLineHealthy(line));

    return {
      label: 'Remote Docker services',
      ok: unhealthy.length === 0,
      detail: unhealthy.length > 0 ? unhealthy.join('\n') : output.trim(),
    };
  } catch (error) {
    return { label: 'Remote Docker services', ok: false, detail: formatError(error) };
  }
}

async function nangoApiCheck(
  config: Awaited<ReturnType<typeof requireAwsConfig>>,
): Promise<DoctorCheck> {
  if (!config.secrets.nangoSecretKey) {
    return {
      label: 'Hosted Nango API key',
      ok: false,
      detail:
        'Open the hosted Nango dashboard, copy the dev API key, then run `company-brain resume --target cloud`.',
    };
  }

  try {
    await verifyHostedNangoApi(config);
    return { label: 'Hosted Nango API key', ok: true };
  } catch (error) {
    return { label: 'Hosted Nango API key', ok: false, detail: formatError(error) };
  }
}

function formatComposeSummary(services: ComposeService[], verbose: boolean): string {
  if (services.length === 0) {
    return 'No services found. Run `company-brain setup --target local`.';
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

function composeLineHealthy(line: string): boolean {
  const [, state = '', health = '', exitCode = ''] = line.split('|');
  if (health) {
    return health === 'healthy';
  }
  if (state === 'exited') {
    return exitCode === '0';
  }

  return state === 'running';
}
