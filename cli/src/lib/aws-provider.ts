import { intro, note, outro } from '@clack/prompts';
import { type AwsConfig, readAwsConfig, requireAwsConfig, writeAwsConfig } from './aws-config.ts';
import { withAwsCredentials } from './aws-credentials.ts';
import {
  continueAwsDeployment,
  deployAwsApplication,
  provisionAwsInfrastructure,
} from './aws-deployment.ts';
import {
  destroyAwsDeployment,
  manualDnsCleanupMessage,
  summarizeAwsDestroy,
} from './aws-destroy.ts';
import { dnsIssues, httpsIssues } from './aws-dns.ts';
import { verifyHostedNangoApi } from './aws-nango.ts';
import { collectAwsConfig } from './aws-prompts.ts';
import { runRemoteHealthCommand } from './aws-ssm.ts';
import {
  type AwsPrerequisites,
  verifyAwsDestroyPrerequisites,
  verifyAwsPrerequisites,
} from './aws-tools.ts';
import type {
  CloudHostedNangoContext,
  CloudProvider,
  CloudSyncSelectionConfig,
} from './cloud-provider.ts';
import { awsDestroyPhrase, confirmDestructiveAction } from './destroy-confirmation.ts';
import { type DoctorCheck, formatError, renderDoctorChecks } from './doctor.ts';
import { hostedExistingNangoEnv } from './hosted-nango-env.ts';
import { isNonInteractive } from './interaction.ts';
import type { nangoIntegrationSpecs } from './nango.ts';
import { ensureCloudNangoApiKey } from './nango-api-key.ts';
import { ensureReleaseAssets } from './release.ts';

type AwsHostedState = {
  awsConfig?: AwsConfig;
};

export const awsProvider: CloudProvider = {
  id: 'aws',
  label: 'AWS',
  setup: setupAws,
  resume: resumeAws,
  update: updateAws,
  doctor: doctorAws,
  destroy: destroyAws,
  loadHostedNangoContext: loadAwsHostedNangoContext,
  persistAddedIntegrations: persistAwsAddedIntegrations,
  persistAddedSyncs: persistAwsAddedSyncs,
  defaultIntegrationIds: awsDefaultIntegrationIds,
  syncSelectionConfig: awsSyncSelectionConfig,
  resolveAgentSyncTarget: resolveAwsAgentSyncTarget,
};

async function setupAws(
  options: { force?: boolean; yes?: boolean },
  { rootOptions, print }: Parameters<CloudProvider['setup']>[1],
): Promise<void> {
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
}

async function updateAws(
  options: { yes?: boolean; version?: string },
  { rootOptions, print }: Parameters<CloudProvider['update']>[1],
): Promise<void> {
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
}

async function resumeAws(
  options: { yes?: boolean },
  { rootOptions, print }: Parameters<CloudProvider['resume']>[1],
): Promise<void> {
  const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

  intro('Company Brain cloud resume');

  const context = {
    yes: Boolean(options.yes),
    nonInteractive,
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
  await continueAwsDeployment({
    config: withAwsCredentials(config, prerequisites),
    context,
    print,
  });

  outro('Cloud resume flow finished.');
}

async function doctorAws(
  options: { yes?: boolean },
  { rootOptions, print }: Parameters<CloudProvider['doctor']>[1],
): Promise<void> {
  const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

  intro('Company Brain cloud check');

  const context = {
    yes: Boolean(options.yes),
    nonInteractive,
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
      detail: config.outputs ? config.outputs.instanceId : 'Run `company-brain setup`.',
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
    print.warn(`${failed.length} cloud check(s) need attention.`);
  } else {
    print.success('Hosted deployment looks healthy.');
  }

  outro('Cloud doctor finished.');
}

async function destroyAws({
  rootOptions,
  print,
}: Parameters<CloudProvider['destroy']>[0]): Promise<void> {
  const nonInteractive = isNonInteractive(rootOptions['non-interactive']);

  intro('Company Brain cloud destroy');

  const context = { nonInteractive };
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
    print,
  });

  print.success(
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

async function loadAwsHostedNangoContext(overrides: {
  nangoSecretKey?: string;
  nangoUrl?: string;
}): Promise<CloudHostedNangoContext<AwsHostedState>> {
  const awsConfig = await readAwsConfig();
  return {
    providerId: 'aws',
    env: hostedExistingNangoEnv(awsConfig, {
      nangoHostport: overrides.nangoUrl,
      nangoSecretKey: overrides.nangoSecretKey,
    }),
    state: { awsConfig },
  };
}

async function persistAwsAddedIntegrations(
  context: CloudHostedNangoContext,
  env: Record<string, string>,
  selected: (typeof nangoIntegrationSpecs)[number][],
  integrationIds: string[],
): Promise<void> {
  const config = awsConfigFromContext(context);
  if (!config) {
    return;
  }

  await writeAwsHostedNangoConfig(config, env, selected, integrationIds);
}

async function persistAwsAddedSyncs(
  context: CloudHostedNangoContext,
  integrationIds: string[],
): Promise<void> {
  const config = awsConfigFromContext(context);
  if (!config) {
    return;
  }

  await writeAwsConfig({
    ...config,
    selectedIntegrationIds: integrationIds,
    syncsDeployedAt: new Date().toISOString(),
    secrets: {
      ...config.secrets,
      nangoSecretKey: context.env.NANGO_SECRET_KEY_DEV,
    },
  });
}

function awsDefaultIntegrationIds(context: CloudHostedNangoContext): string[] {
  return awsConfigFromContext(context)?.selectedIntegrationIds ?? [];
}

function awsSyncSelectionConfig(context: CloudHostedNangoContext): CloudSyncSelectionConfig {
  const selectedIntegrationIds = awsConfigFromContext(context)?.selectedIntegrationIds ?? [];
  return {
    installedIntegrationIds: selectedIntegrationIds,
    selectedIntegrationIds,
  };
}

async function resolveAwsAgentSyncTarget(
  nonInteractive: boolean,
  print: Parameters<CloudProvider['resolveAgentSyncTarget']>[1],
): Promise<{ nangoUrl: string; nangoSecretKey: string; webhookSecret: string }> {
  let config = await requireAwsConfig();
  if (!config.outputs || !config.appDeployedAt) {
    throw new Error('Cloud Company Brain is not deployed. Run: company-brain setup');
  }

  const issues = await httpsIssues(config);
  if (issues.length > 0) {
    note(issues.join('\n'), 'Cloud HTTPS check');
    throw new Error('Cloud Company Brain is not reachable. Run: company-brain resume');
  }

  config = await ensureCloudNangoApiKey(config, nonInteractive, print);
  const nangoSecretKey = requireValue(config.secrets.nangoSecretKey, 'Cloud Nango dev API key');
  return {
    nangoUrl: `https://${config.nangoHostname}`,
    nangoSecretKey,
    webhookSecret: config.agentSyncWebhookSecret,
  };
}

async function writeAwsHostedNangoConfig(
  config: AwsConfig,
  env: Record<string, string>,
  selected: (typeof nangoIntegrationSpecs)[number][],
  integrationIds: string[],
): Promise<void> {
  const oauth = { ...config.secrets.oauth };
  const scopes = { ...config.scopes };

  for (const integration of selected) {
    if (!integration.oauth) {
      continue;
    }

    oauth[integration.oauth.clientIdEnv] = requiredNangoEnv(env, integration.oauth.clientIdEnv);
    oauth[integration.oauth.clientSecretEnv] = requiredNangoEnv(
      env,
      integration.oauth.clientSecretEnv,
    );

    if (integration.oauth.scopesEnv && integration.oauth.scopes) {
      scopes[integration.oauth.scopesEnv] =
        env[integration.oauth.scopesEnv] ??
        scopes[integration.oauth.scopesEnv] ??
        integration.oauth.scopes;
    }
  }

  await writeAwsConfig({
    ...config,
    selectedIntegrationIds: integrationIds,
    nangoBootstrappedAt: new Date().toISOString(),
    syncsDeployedAt: sameItems(config.selectedIntegrationIds, integrationIds)
      ? config.syncsDeployedAt
      : undefined,
    scopes,
    secrets: {
      ...config.secrets,
      nangoSecretKey: env.NANGO_SECRET_KEY_DEV,
      oauth,
    },
  });
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
        'Open the hosted Nango dashboard, copy the dev API key, then run `company-brain resume`.',
    };
  }

  try {
    await verifyHostedNangoApi(config);
    return { label: 'Hosted Nango API key', ok: true };
  } catch (error) {
    return { label: 'Hosted Nango API key', ok: false, detail: formatError(error) };
  }
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

function awsConfigFromContext(context: CloudHostedNangoContext): AwsConfig | undefined {
  if (context.providerId !== 'aws') {
    throw new Error(`Hosted Nango context belongs to ${context.providerId}, not aws.`);
  }

  return (context as CloudHostedNangoContext<AwsHostedState>).state?.awsConfig;
}

function formatCredentialSource(prerequisites: AwsPrerequisites): string {
  const source = prerequisites.awsProfile
    ? `current shell profile "${prerequisites.awsProfile}"`
    : 'current shell default credential chain';
  const expiration = prerequisites.awsCredentials.expiration;

  return expiration ? `${source}; exported credentials expire at ${expiration}` : source;
}

function requiredNangoEnv(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required Nango setting: ${key}`);
  }

  return value;
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }

  return value;
}

function sameItems(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightItems = new Set(right);
  return left.every((value) => rightItems.has(value));
}
