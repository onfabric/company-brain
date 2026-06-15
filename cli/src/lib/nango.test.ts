import { afterEach, describe, expect, it } from 'bun:test';
import { bootstrappedConnectionIntegrationIds, nangoCommandEnv } from './nango.ts';

const originalIntegrationsDir = process.env.COMPANY_BRAIN_INTEGRATIONS_DIR;

afterEach(() => {
  if (originalIntegrationsDir === undefined) {
    delete process.env.COMPANY_BRAIN_INTEGRATIONS_DIR;
    return;
  }

  process.env.COMPANY_BRAIN_INTEGRATIONS_DIR = originalIntegrationsDir;
});

describe('bootstrappedConnectionIntegrationIds', () => {
  it('does not bootstrap OAuth connections through the non-OAuth path', () => {
    expect(bootstrappedConnectionIntegrationIds(['notion'])).toEqual([]);
  });

  it('returns CLI-created non-OAuth connections', () => {
    expect(bootstrappedConnectionIntegrationIds(['agent-conversations'])).toEqual([
      'agent-conversations',
    ]);
  });
});

describe('nangoCommandEnv', () => {
  it('marks release-managed integrations as packaged', () => {
    delete process.env.COMPANY_BRAIN_INTEGRATIONS_DIR;

    expect(nangoCommandEnv({ FOO: 'bar' })).toEqual({
      FOO: 'bar',
      COMPANY_BRAIN_PACKAGED_INTEGRATIONS: 'true',
    });
  });

  it('builds generated integration artifacts for source checkouts', () => {
    process.env.COMPANY_BRAIN_INTEGRATIONS_DIR = '/repo/nango-integrations';

    expect(nangoCommandEnv({ FOO: 'bar' })).toEqual({
      FOO: 'bar',
      COMPANY_BRAIN_PACKAGED_INTEGRATIONS: 'false',
    });
  });
});
