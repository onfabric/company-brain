import { describe, expect, it } from 'bun:test';
import type { AwsConfig } from './aws-config.ts';
import {
  assertConfiguredAccountMatchesCurrentAccount,
  configuredAccountId,
  manualDnsCleanupMessage,
  normalizeObjectVersions,
  repositoryNameFromUrl,
} from './aws-destroy.ts';

describe('AWS destroy helpers', () => {
  it('derives the configured AWS account from ECR outputs', () => {
    expect(configuredAccountId(config().outputs)).toBe('123456789012');
  });

  it('blocks teardown with credentials for a different AWS account', () => {
    expect(() => assertConfiguredAccountMatchesCurrentAccount(config(), '210987654321')).toThrow(
      'current credentials are for 210987654321',
    );
  });

  it('accepts teardown with credentials for the configured AWS account', () => {
    expect(() =>
      assertConfiguredAccountMatchesCurrentAccount(config(), '123456789012'),
    ).not.toThrow();
  });

  it('extracts ECR repository names from repository URLs', () => {
    expect(
      repositoryNameFromUrl('123456789012.dkr.ecr.eu-west-2.amazonaws.com/company-brain-dev/brain'),
    ).toBe('company-brain-dev/brain');
  });

  it('strips AWS metadata before deleting S3 object versions', () => {
    expect(
      normalizeObjectVersions([
        {
          Key: 'company-brain/dev/terraform.tfstate',
          VersionId: 'version-1',
          IsLatest: false,
          LastModified: '2026-06-14T10:00:00.000Z',
          Owner: { ID: 'owner' },
          StorageClass: 'STANDARD',
        },
        {
          Key: 'company-brain/dev/terraform.tfstate',
          VersionId: 'delete-marker-1',
          IsLatest: true,
        },
        { Key: 'missing-version' },
      ]),
    ).toEqual([
      { Key: 'company-brain/dev/terraform.tfstate', VersionId: 'version-1' },
      { Key: 'company-brain/dev/terraform.tfstate', VersionId: 'delete-marker-1' },
    ]);
  });

  it('builds a final manual DNS cleanup reminder', () => {
    expect(manualDnsCleanupMessage(config())).toContain('A nango.example.com -> 203.0.113.10');
    expect(manualDnsCleanupMessage(config())).toContain('AAAA logs.example.com -> 2001:db8::10');
  });

  it('does not ask for manual DNS cleanup when Route53 owns DNS', () => {
    expect(
      manualDnsCleanupMessage({
        ...config(),
        dns: { mode: 'route53', hostedZoneId: 'Z123' },
      }),
    ).toBeUndefined();
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
      nangoEcrRepositoryUrl: '123456789012.dkr.ecr.eu-west-2.amazonaws.com/company-brain-dev/nango',
      brainEcrRepositoryUrl: '123456789012.dkr.ecr.eu-west-2.amazonaws.com/company-brain-dev/brain',
      pgBackupEcrRepositoryUrl:
        '123456789012.dkr.ecr.eu-west-2.amazonaws.com/company-brain-dev/pg-backup',
      artifactsBucket: 'company-brain-deploy-123456789012-dev',
      instanceId: 'i-123',
      dataVolumeId: 'vol-123',
      deployGroupTag: 'company-brain-dev',
    },
    secrets: { oauth: {} },
  };
}
