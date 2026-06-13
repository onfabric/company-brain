import { describe, expect, it } from 'bun:test';
import type { AwsConfig } from './aws-config.ts';
import { publicDnsRecords } from './aws-config.ts';

describe('publicDnsRecords', () => {
  it('builds A and AAAA records for every public hostname', () => {
    const records = publicDnsRecords(config());

    expect(records).toEqual([
      { type: 'A', name: 'nango.example.com', value: '203.0.113.10' },
      { type: 'A', name: 'connect.example.com', value: '203.0.113.10' },
      { type: 'A', name: 'brain.example.com', value: '203.0.113.10' },
      { type: 'A', name: 'logs.example.com', value: '203.0.113.10' },
      { type: 'AAAA', name: 'nango.example.com', value: '2001:db8::10' },
      { type: 'AAAA', name: 'connect.example.com', value: '2001:db8::10' },
      { type: 'AAAA', name: 'brain.example.com', value: '2001:db8::10' },
      { type: 'AAAA', name: 'logs.example.com', value: '2001:db8::10' },
    ]);
  });
});

function config(): AwsConfig {
  return {
    version: 1,
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
    workspaceDomain: 'example.com',
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
      nangoEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/company-brain/nango',
      brainEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/company-brain/brain',
      pgBackupEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/company-brain/pg-backup',
      artifactsBucket: 'company-brain-deploy-123-dev',
      instanceId: 'i-123',
      dataVolumeId: 'vol-123',
      deployGroupTag: 'company-brain-dev',
    },
    secrets: { oauth: {} },
  };
}
