import { lookup } from 'node:dns/promises';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AwsConfig, PublicDnsRecord } from './aws-config.ts';
import { publicDnsRecords } from './aws-config.ts';
import { awsCommandEnv } from './aws-credentials.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const DNS_TIMEOUT_MINUTES = 10;
const DNS_POLL_MS = 10_000;
const DNS_TIMEOUT_MS = DNS_TIMEOUT_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const HTTPS_TIMEOUT_MS = DNS_TIMEOUT_MS;
const FETCH_TIMEOUT_MS = 10_000;
const HTTP_SERVER_ERROR_STATUS = 500;
const IPV4 = 4;
const IPV6 = 6;

export function formatDnsRecords(config: AwsConfig): string {
  const records = publicDnsRecords(config);
  if (records.length === 0) {
    return 'Terraform outputs are not available yet.';
  }

  return records.map((record) => `${record.type} ${record.name} -> ${record.value}`).join('\n');
}

export async function upsertRoute53Records(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  const hostedZoneId = config.dns.hostedZoneId;
  if (!hostedZoneId) {
    throw new Error('Route53 DNS mode requires a hosted zone ID.');
  }

  const records = publicDnsRecords(config);
  const changeBatchPath = join(tmpdir(), `company-brain-dns-${config.environment}.json`);
  const env = awsCommandEnv(config);
  await writeFile(changeBatchPath, JSON.stringify(route53ChangeBatch(records), null, 2));

  const changeId = await runVisible(
    [
      'aws',
      'route53',
      'change-resource-record-sets',
      '--hosted-zone-id',
      hostedZoneId,
      '--change-batch',
      `file://${changeBatchPath}`,
      '--query',
      'ChangeInfo.Id',
      '--output',
      'text',
    ],
    context,
    {
      approve: true,
      env,
      purpose: 'Create or update public DNS records in Route53.',
    },
  );

  await runVisible(
    ['aws', 'route53', 'wait', 'resource-record-sets-changed', '--id', changeId.trim()],
    context,
    { env, purpose: 'Wait for Route53 to publish the DNS change.' },
  );
}

export async function waitForDnsRecords(config: AwsConfig): Promise<string[]> {
  const startedAt = Date.now();
  let issues: string[] = [];

  while (Date.now() - startedAt < DNS_TIMEOUT_MS) {
    issues = await dnsIssues(config);
    if (issues.length === 0) {
      return [];
    }
    await Bun.sleep(DNS_POLL_MS);
  }

  return issues;
}

export async function dnsIssues(config: AwsConfig): Promise<string[]> {
  const outputs = config.outputs;
  if (!outputs) {
    return ['Terraform outputs are missing.'];
  }

  const issues: string[] = [];
  for (const host of [
    config.nangoHostname,
    config.nangoConnectHostname,
    config.brainHostname,
    config.dozzleHostname,
  ]) {
    const ipv4 = await lookupAddresses(host, IPV4);
    if (!ipv4.includes(outputs.publicIp)) {
      issues.push(
        `${host} A record resolves to ${formatAddresses(ipv4)}, expected ${outputs.publicIp}`,
      );
    }

    if (outputs.publicIpv6) {
      const ipv6 = await lookupAddresses(host, IPV6);
      if (!ipv6.includes(outputs.publicIpv6)) {
        issues.push(
          `${host} AAAA record resolves to ${formatAddresses(ipv6)}, expected ${outputs.publicIpv6}`,
        );
      }
    }
  }

  return issues;
}

export async function httpsIssues(config: AwsConfig): Promise<string[]> {
  const checks = [
    { label: 'Nango', url: `https://${config.nangoHostname}` },
    { label: 'Nango Connect', url: `https://${config.nangoConnectHostname}` },
    { label: 'Brain', url: `https://${config.brainHostname}/health`, requireOk: true },
    { label: 'Dozzle', url: `https://${config.dozzleHostname}` },
  ];
  const issues: string[] = [];

  for (const check of checks) {
    try {
      const response = await fetch(check.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (check.requireOk ? !response.ok : response.status >= HTTP_SERVER_ERROR_STATUS) {
        issues.push(`${check.label} returned HTTP ${response.status} at ${check.url}`);
      }
    } catch (error) {
      issues.push(`${check.label} is not reachable at ${check.url}: ${formatError(error)}`);
    }
  }

  return issues;
}

export async function waitForHttps(config: AwsConfig): Promise<string[]> {
  const startedAt = Date.now();
  let issues: string[] = [];

  while (Date.now() - startedAt < HTTPS_TIMEOUT_MS) {
    issues = await httpsIssues(config);
    if (issues.length === 0) {
      return [];
    }
    await Bun.sleep(DNS_POLL_MS);
  }

  return issues;
}

function route53ChangeBatch(records: PublicDnsRecord[]): unknown {
  return {
    Changes: records.map((record) => ({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: record.name,
        Type: record.type,
        TTL: 60,
        ResourceRecords: [{ Value: record.value }],
      },
    })),
  };
}

async function lookupAddresses(host: string, family: 4 | 6): Promise<string[]> {
  try {
    return (await lookup(host, { all: true, family })).map((address) => address.address);
  } catch {
    return [];
  }
}

function formatAddresses(addresses: string[]): string {
  return addresses.length > 0 ? addresses.join(', ') : 'nothing';
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
