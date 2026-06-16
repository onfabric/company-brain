import { describe, expect, it } from 'bun:test';
import type { AwsConfig } from './aws-config.ts';
import { publicDnsRecords } from './aws-config.ts';
import { dnsIssues, route53RecordSetsToDelete } from './aws-dns.ts';

const IPV4 = 4;
const IPV6 = 6;

describe('dnsIssues', () => {
  it('checks A and AAAA records by DNS record type', async () => {
    const queries: Array<{ family: typeof IPV4 | typeof IPV6; host: string }> = [];
    const issues = await dnsIssues(config(), (host, family) => {
      queries.push({ family, host });

      return Promise.resolve(family === IPV4 ? ['203.0.113.10'] : ['2001:db8::10']);
    });

    expect(issues).toEqual([]);
    expect(queries).toEqual([
      { host: 'nango.example.com', family: 4 },
      { host: 'nango.example.com', family: 6 },
      { host: 'connect.example.com', family: 4 },
      { host: 'connect.example.com', family: 6 },
      { host: 'brain.example.com', family: 4 },
      { host: 'brain.example.com', family: 6 },
      { host: 'logs.example.com', family: 4 },
      { host: 'logs.example.com', family: 6 },
    ]);
  });
});

describe('route53RecordSetsToDelete', () => {
  it('keeps only matching Company Brain public records', () => {
    expect(
      route53RecordSetsToDelete(
        [
          {
            Name: 'nango.example.com.',
            Type: 'A',
            TTL: 60,
            ResourceRecords: [{ Value: '203.0.113.10' }],
          },
          {
            Name: 'other.example.com.',
            Type: 'A',
            TTL: 60,
            ResourceRecords: [{ Value: '203.0.113.10' }],
          },
          {
            Name: 'brain.example.com.',
            Type: 'A',
            TTL: 300,
            ResourceRecords: [{ Value: '198.51.100.10' }],
          },
        ],
        publicDnsRecords(config()),
      ),
    ).toEqual([
      {
        Name: 'nango.example.com.',
        Type: 'A',
        TTL: 60,
        ResourceRecords: [{ Value: '203.0.113.10' }],
      },
    ]);
  });
});

function config(): AwsConfig {
  return {
    version: 1,
    awsAccountId: '123456789012',
    region: 'eu-west-2',
    environment: 'dev',
    instanceType: 't3.large',
    rootVolumeSize: 50,
    dataVolumeSize: 50,
    ssmSecretPrefix: '/company-brain/dev',
    nangoHostname: 'nango.example.com',
    nangoConnectHostname: 'connect.example.com',
    brainHostname: 'brain.example.com',
    dozzleHostname: 'logs.example.com',
    acmeEmail: 'ops@example.com',
    allowedDashboardAccountsEmails: '*@example.com',
    googleClientId: 'client-id',
    dozzleUsername: 'admin',
    dozzleEmail: 'ops@example.com',
    dozzleName: 'Admin',
    agentSyncWebhookSecret: 'webhook-secret',
    selectedIntegrationIds: ['agent-conversations'],
    scopes: {},
    dns: { mode: 'manual' },
    outputs: {
      publicIp: '203.0.113.10',
      publicIpv6: '2001:db8::10',
      artifactsBucket: 'company-brain-deploy-123-dev',
      instanceId: 'i-123',
      dataVolumeId: 'vol-123',
      deployGroupTag: 'company-brain-dev',
    },
    secrets: { oauth: {} },
  };
}
