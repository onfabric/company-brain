import { describe, expect, it } from 'bun:test';
import type { AwsConfig } from './aws-config.ts';
import { hostedNangoEnv, hostedNangoEnvDefaults, publicDnsRecords } from './aws-config.ts';

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

describe('hostedNangoEnvDefaults', () => {
  it('builds hosted Nango env without requiring the API key', () => {
    const values = hostedNangoEnvDefaults({
      ...config(),
      scopes: { NOTION_SCOPES: 'read' },
      secrets: {
        oauth: { NOTION_CLIENT_ID: 'client-id' },
      },
    });

    expect(values).toMatchObject({
      NANGO_HOSTPORT: 'https://nango.example.com',
      AGENT_SYNC_WEBHOOK_SECRET: 'webhook-secret',
      NOTION_CLIENT_ID: 'client-id',
      NOTION_SCOPES: 'read',
    });
    expect(values.NANGO_SECRET_KEY_DEV).toBeUndefined();
  });

  it('points missing API keys at the hosted integrations command', () => {
    expect(() => hostedNangoEnv(config())).toThrow(
      'bun run company-brain nango integrations --hosted',
    );
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
      nangoEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/company-brain-dev/nango',
      brainEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/company-brain-dev/brain',
      pgBackupEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/company-brain-dev/pg-backup',
      artifactsBucket: 'company-brain-deploy-123-dev',
      instanceId: 'i-123',
      dataVolumeId: 'vol-123',
      deployGroupTag: 'company-brain-dev',
    },
    secrets: { oauth: {} },
  };
}
