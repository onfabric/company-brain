import { describe, expect, it } from 'bun:test';
import type { AwsConfig } from './aws-config.ts';
import { deriveAwsHostnames, inferBaseDomain } from './aws-hostnames.ts';

describe('deriveAwsHostnames', () => {
  it('derives service hostnames from environment and base domain', () => {
    expect(deriveAwsHostnames('mex', 'https://onfabric.io/')).toEqual({
      nangoHostname: 'nango-mex.onfabric.io',
      nangoConnectHostname: 'nango-auth-mex.onfabric.io',
      brainHostname: 'brain-mex.onfabric.io',
      dozzleHostname: 'dozzle-mex.onfabric.io',
    });
  });
});

describe('inferBaseDomain', () => {
  it('infers a base domain from derived service hostnames', () => {
    expect(inferBaseDomain(config())).toBe('onfabric.io');
  });

  it('does not infer a base domain from custom service hostnames', () => {
    expect(
      inferBaseDomain({
        ...config(),
        nangoConnectHostname: 'connect.onfabric.io',
      }),
    ).toBeUndefined();
  });
});

function config(): AwsConfig {
  return {
    version: 1,
    awsAccountId: '123456789012',
    region: 'eu-west-2',
    environment: 'mex',
    instanceType: 't3.large',
    rootVolumeSize: 50,
    dataVolumeSize: 50,
    ssmSecretPrefix: '/company-brain/mex',
    nangoHostname: 'nango-mex.onfabric.io',
    nangoConnectHostname: 'nango-auth-mex.onfabric.io',
    brainHostname: 'brain-mex.onfabric.io',
    dozzleHostname: 'dozzle-mex.onfabric.io',
    acmeEmail: 'ops@onfabric.io',
    allowedDashboardAccountsEmails: '*@onfabric.io',
    googleClientId: 'client-id',
    dozzleUsername: 'admin',
    dozzleEmail: 'ops@onfabric.io',
    dozzleName: 'Admin',
    agentSyncWebhookSecret: 'webhook-secret',
    selectedIntegrationIds: ['agent-conversations'],
    scopes: {},
    dns: { mode: 'manual' },
    secrets: { oauth: {} },
  };
}
