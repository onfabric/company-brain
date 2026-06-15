import { describe, expect, it } from 'bun:test';
import { resolveSyncSelection, syncsForIntegrationIds } from './sync-deployment.ts';

describe('syncsForIntegrationIds', () => {
  it('returns every sync for the selected integrations', () => {
    expect(syncsForIntegrationIds(['notion', 'slack']).map((sync) => sync.integrationId)).toEqual([
      'notion',
      'slack',
    ]);
  });
});

describe('resolveSyncSelection', () => {
  it('uses installed integrations by default', () => {
    const selected = resolveSyncSelection(undefined, false, false, {
      installedIntegrationIds: ['notion'],
      selectedIntegrationIds: ['slack'],
    });

    expect(selected.map((sync) => sync.integrationId)).toEqual(['notion']);
  });

  it('falls back to previously deployed sync integrations', () => {
    const selected = resolveSyncSelection(undefined, false, false, {
      installedIntegrationIds: [],
      selectedIntegrationIds: ['slack'],
    });

    expect(selected.map((sync) => sync.integrationId)).toEqual(['slack']);
  });

  it('lets --only override saved selection', () => {
    const selected = resolveSyncSelection('github', false, false, {
      installedIntegrationIds: ['notion'],
      selectedIntegrationIds: [],
    });

    expect(selected.map((sync) => sync.integrationId)).toEqual(['github']);
  });

  it('uses managed syncs for --all', () => {
    const selected = resolveSyncSelection(undefined, true, true, {
      installedIntegrationIds: [],
      selectedIntegrationIds: [],
    });

    expect(selected.map((sync) => sync.integrationId)).toEqual([
      'notion',
      'slack',
      'github',
      'google-mail',
    ]);
  });

  it('errors in non-interactive mode when no selection exists', () => {
    expect(() =>
      resolveSyncSelection(undefined, false, true, {
        installedIntegrationIds: [],
        selectedIntegrationIds: [],
      }),
    ).toThrow('Pass --only notion,slack or --all when running without a TTY.');
  });
});
