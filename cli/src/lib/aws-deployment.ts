import { note } from '@clack/prompts';
import { uploadRuntimeBundle } from './aws-bundle.ts';
import type { AwsConfig } from './aws-config.ts';
import { writeAwsConfig } from './aws-config.ts';
import {
  formatDnsRecords,
  upsertRoute53Records,
  waitForDnsRecords,
  waitForHttps,
} from './aws-dns.ts';
import { buildAndPushImages } from './aws-images.ts';
import {
  bootstrapHostedNango,
  checkHostedNangoConnections,
  deployHostedNangoSyncs,
  verifyHostedNangoApi,
} from './aws-nango.ts';
import { confirmManualDnsReady, promptHostedNangoKey } from './aws-prompts.ts';
import { deployOverSsm, putDozzleUsers } from './aws-ssm.ts';
import { applyAwsTerraform } from './aws-terraform.ts';
import type { VisibleCommandContext } from './visible-command.ts';

const DEPLOY_ID_LENGTH = 14;

type Printer = {
  success: (message: string) => void;
  warn: (message: string) => void;
};

export async function provisionAwsInfrastructure(
  config: AwsConfig,
  context: VisibleCommandContext,
  print: Printer,
): Promise<AwsConfig> {
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

  current = await ensureNangoKey(current, context, print);
  if (!current.secrets.nangoSecretKey) {
    return current;
  }

  if (!current.nangoBootstrappedAt) {
    await bootstrapHostedNango(current, context);
    current = { ...current, nangoBootstrappedAt: new Date().toISOString() };
    await writeAwsConfig(current);
    print.success('Hosted Nango integrations are bootstrapped.');
  }

  try {
    await checkHostedNangoConnections(current, context);
  } catch (error) {
    print.warn(formatError(error));
    note(
      [
        `Open https://${current.nangoHostname}`,
        'Create OAuth connections for the integrations listed above, then run:',
        'bun run company-brain aws resume',
      ].join('\n'),
      'OAuth connections required',
    );
    return current;
  }

  if (!current.syncsDeployedAt) {
    await deployHostedNangoSyncs(current, context);
    current = { ...current, syncsDeployedAt: new Date().toISOString() };
    await writeAwsConfig(current);
    print.success('Hosted Nango syncs are deployed.');
  }

  print.success('AWS deployment is complete.');
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

  const images = await buildAndPushImages(withDeployId, deployId, context);
  const bundleUrl = await uploadRuntimeBundle(withDeployId, deployId, context);
  await deployOverSsm({ config: withDeployId, images, bundleUrl, context });

  const deployed = { ...withDeployId, appDeployedAt: new Date().toISOString() };
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
  } else if (!(await confirmManualDnsReady(Boolean(context.nonInteractive)))) {
    note(
      [
        'Create the DNS records above in your DNS provider.',
        'Use DNS-only records if your provider has a proxy mode.',
        'Then run: bun run company-brain aws resume',
      ].join('\n'),
      'Manual DNS required',
    );
    return false;
  }

  const issues = await waitForDnsRecords(config);
  if (issues.length > 0) {
    print.warn('DNS records are not ready yet.');
    note(issues.join('\n'), 'DNS check');
    note('Fix DNS, wait for propagation, then run: bun run company-brain aws resume', 'Next');
    return false;
  }

  print.success('DNS records resolve to the AWS instance.');
  return true;
}

async function ensureHttps(config: AwsConfig, print: Printer): Promise<boolean> {
  const issues = await waitForHttps(config);
  if (issues.length > 0) {
    print.warn('HTTPS is not ready yet.');
    note(
      [
        ...issues,
        '',
        'Common causes: DNS records are wrong, a DNS proxy is enabled, or ports 80/443 are blocked.',
        'After fixing it, run: bun run company-brain aws resume',
      ].join('\n'),
      'Certificate/service check',
    );
    return false;
  }

  print.success('HTTPS endpoints and certificates are healthy.');
  return true;
}

async function ensureNangoKey(
  config: AwsConfig,
  context: VisibleCommandContext,
  print: Printer,
): Promise<AwsConfig> {
  const nangoSecretKey = await promptHostedNangoKey(
    config.secrets.nangoSecretKey,
    Boolean(context.nonInteractive),
  );
  if (!nangoSecretKey) {
    note(
      [
        `Open https://${config.nangoHostname}`,
        'Create or sign in to the hosted Nango dashboard.',
        'Copy the dev API key, then run: bun run company-brain aws resume',
      ].join('\n'),
      'Nango API key required',
    );
    return config;
  }

  const updated = { ...config, secrets: { ...config.secrets, nangoSecretKey } };
  await verifyHostedNangoApi(updated);
  await writeAwsConfig(updated);
  print.success('Hosted Nango API key works.');

  return updated;
}

function makeDeployId(): string {
  return new Date().toISOString().replace(/\D/g, '').slice(0, DEPLOY_ID_LENGTH);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
