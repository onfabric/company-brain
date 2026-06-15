import { log, note } from '@clack/prompts';
import { uploadRuntimeBundle } from './aws-bundle.ts';
import type { AwsConfig } from './aws-config.ts';
import { writeAwsConfig } from './aws-config.ts';
import {
  formatDnsRecords,
  upsertRoute53Records,
  type WaitProgress,
  waitForDnsRecords,
  waitForHttps,
} from './aws-dns.ts';
import { confirmManualDnsReady } from './aws-prompts.ts';
import { deployOverSsm, putDozzleUsers } from './aws-ssm.ts';
import { applyAwsTerraform } from './aws-terraform.ts';
import { deploymentImageUrisFromManifest } from './deployment-contract.ts';
import { ensureCloudNangoApiKey } from './nango-api-key.ts';
import { ensureReleaseAssets } from './release.ts';
import type { VisibleCommandContext } from './visible-command.ts';

const DEPLOY_ID_LENGTH = 14;
const FIRST_WAIT_ATTEMPT = 1;
const WAIT_PROGRESS_LOG_INTERVAL = 3;
const MAX_WAIT_PROGRESS_ISSUES = 3;

type Printer = {
  success: (message: string) => void;
  warn: (message: string) => void;
};

export async function provisionAwsInfrastructure(
  config: AwsConfig,
  context: VisibleCommandContext,
  print: Printer,
): Promise<AwsConfig> {
  await ensureReleaseAssets();
  const outputs = await applyAwsTerraform(config, context);
  const updated = { ...config, outputs };
  await writeAwsConfig(updated);
  await putDozzleUsers(updated, context);
  print.success('AWS infrastructure is ready.');

  return updated;
}

export async function continueAwsDeployment({
  config,
  context,
  print,
}: {
  config: AwsConfig;
  context: VisibleCommandContext;
  print: Printer;
}): Promise<AwsConfig> {
  let current = config;

  if (!current.outputs) {
    current = await provisionAwsInfrastructure(current, context, print);
  }

  if (!current.dns.verifiedAt) {
    const dnsReady = await ensureDns(current, context, print);
    if (!dnsReady) {
      return current;
    }
    current = { ...current, dns: { ...current.dns, verifiedAt: new Date().toISOString() } };
    await writeAwsConfig(current);
  }

  if (!current.appDeployedAt) {
    current = await deployAwsApplication(current, context, print);
  }

  const httpsReady = await ensureHttps(current, print);
  if (!httpsReady) {
    return current;
  }

  current = await ensureCloudNangoApiKey(current, Boolean(context.nonInteractive), print);
  print.success('Hosted deployment is ready for Nango configuration.');
  note(
    [
      `Brain dashboard: https://${current.brainHostname}/dashboard`,
      `Hosted Nango dashboard/login and API keys: https://${current.nangoHostname}`,
      `Dozzle logs: https://${current.dozzleHostname}`,
      '',
      'Next: add integrations or install the cloud agent sync schedule:',
      'company-brain add integrations --target cloud',
      'company-brain agent-sync install --target cloud',
    ].join('\n'),
    'Cloud URLs',
  );
  return current;
}

export async function deployAwsApplication(
  config: AwsConfig,
  context: VisibleCommandContext,
  print: Printer,
): Promise<AwsConfig> {
  const deployId = makeDeployId();
  const withDeployId = { ...config, lastDeployId: deployId };
  await writeAwsConfig(withDeployId);

  const release = await ensureReleaseAssets();
  const images = deploymentImageUrisFromManifest(release.manifest);
  const bundleUrl = await uploadRuntimeBundle(withDeployId, deployId, context);
  await deployOverSsm({ config: withDeployId, images, bundleUrl, context });

  const deployed = {
    ...withDeployId,
    releaseVersion: release.manifest.version,
    releaseGitSha: release.manifest.gitSha,
    appDeployedAt: new Date().toISOString(),
  };
  await writeAwsConfig(deployed);
  print.success('Application containers are deployed and healthy on EC2.');

  return deployed;
}

async function ensureDns(
  config: AwsConfig,
  context: VisibleCommandContext,
  print: Printer,
): Promise<boolean> {
  note(formatDnsRecords(config), 'DNS records');

  if (config.dns.mode === 'route53') {
    await upsertRoute53Records(config, context);
  } else if (
    !(await confirmManualDnsReady(Boolean(context.nonInteractive), Boolean(context.yes)))
  ) {
    note(
      [
        'Create the DNS records above in your DNS provider.',
        'Use DNS-only records if your provider has a proxy mode.',
        'Then run: company-brain resume --target cloud',
      ].join('\n'),
      'Manual DNS required',
    );
    return false;
  }

  log.step('Checking DNS records...');
  const issues = await waitForDnsRecords(config, {
    onRetry: (progress) => logWaitProgress('DNS', progress),
  });
  if (issues.length > 0) {
    print.warn('DNS records are not ready yet.');
    note(issues.join('\n'), 'DNS check');
    note('Fix DNS, wait for propagation, then run: company-brain resume --target cloud', 'Next');
    return false;
  }

  print.success('DNS records resolve to the AWS instance.');
  return true;
}

async function ensureHttps(config: AwsConfig, print: Printer): Promise<boolean> {
  log.step('Checking HTTPS endpoints and certificates...');
  const issues = await waitForHttps(config, {
    onRetry: (progress) => logWaitProgress('HTTPS', progress),
  });
  if (issues.length > 0) {
    print.warn('HTTPS is not ready yet.');
    note(
      [
        ...issues,
        '',
        'Common causes: DNS records are wrong, a DNS proxy is enabled, or ports 80/443 are blocked.',
        'After fixing it, run: company-brain resume --target cloud',
      ].join('\n'),
      'Certificate/service check',
    );
    return false;
  }

  print.success('HTTPS endpoints and certificates are healthy.');
  return true;
}

function makeDeployId(): string {
  return new Date().toISOString().replace(/\D/g, '').slice(0, DEPLOY_ID_LENGTH);
}

function logWaitProgress(label: string, progress: WaitProgress): void {
  if (
    progress.attempt !== FIRST_WAIT_ATTEMPT &&
    progress.attempt % WAIT_PROGRESS_LOG_INTERVAL !== 0
  ) {
    return;
  }

  log.info(
    [
      `${label} check still waiting (${formatWaitTime(progress)})`,
      ...progress.issues.slice(0, MAX_WAIT_PROGRESS_ISSUES).map((issue) => `  ${issue}`),
      ...formatHiddenIssueCount(progress.issues),
    ].join('\n'),
    { spacing: 0 },
  );
}

function formatWaitTime(progress: WaitProgress): string {
  return `${progress.elapsedSeconds}s/${progress.timeoutSeconds}s`;
}

function formatHiddenIssueCount(issues: string[]): string[] {
  const hiddenCount = issues.length - MAX_WAIT_PROGRESS_ISSUES;
  return hiddenCount > 0 ? [`  and ${hiddenCount} more...`] : [];
}
