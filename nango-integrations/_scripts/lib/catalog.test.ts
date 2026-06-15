import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_REQUIRED_CONNECTIONS,
  oauthConnectionHints,
  resolveSelectedIntegrations,
  resolveSelectedSyncs,
} from './catalog.js';

describe('resolveSelectedSyncs', () => {
  it('returns default syncs when no selection is supplied', () => {
    expect(resolveSelectedSyncs(undefined).map((sync) => sync.integrationId)).toContain('notion');
  });

  it('excludes manually managed syncs from the default selection', () => {
    expect(resolveSelectedSyncs(undefined).map((sync) => sync.integrationId)).not.toContain(
      'circleback-mcp',
    );
  });

  it('excludes agent conversations from the default sync selection', () => {
    expect(resolveSelectedSyncs(undefined).map((sync) => sync.integrationId)).not.toContain(
      'agent-conversations',
    );
  });

  it('returns only selected syncs', () => {
    expect(resolveSelectedSyncs(['notion']).map((sync) => sync.integrationId)).toEqual(['notion']);
  });

  it('allows manually managed syncs when explicitly selected', () => {
    expect(resolveSelectedSyncs(['circleback-mcp']).map((sync) => sync.integrationId)).toEqual([
      'circleback-mcp',
    ]);
  });

  it('allows agent conversations when explicitly selected', () => {
    expect(resolveSelectedSyncs(['agent-conversations']).map((sync) => sync.integrationId)).toEqual(
      ['agent-conversations'],
    );
  });

  it('rejects unknown integrations', () => {
    expect(() => resolveSelectedSyncs(['unknown'])).toThrow(
      'Unknown integration selection: unknown',
    );
  });
});

describe('resolveSelectedIntegrations', () => {
  it('returns all programmatically managed integrations when no selection is supplied', () => {
    expect(resolveSelectedIntegrations(undefined).map((integration) => integration.id)).toContain(
      'notion',
    );
  });

  it('excludes manually managed integrations from bootstrap selection', () => {
    expect(
      resolveSelectedIntegrations(undefined).map((integration) => integration.id),
    ).not.toContain('circleback-mcp');
  });

  it('excludes agent conversations from the default bootstrap selection', () => {
    expect(
      resolveSelectedIntegrations(undefined).map((integration) => integration.id),
    ).not.toContain('agent-conversations');
  });

  it('returns only selected integrations', () => {
    expect(resolveSelectedIntegrations(['notion']).map((integration) => integration.id)).toEqual([
      'notion',
    ]);
  });

  it('rejects manually managed integrations', () => {
    expect(() => resolveSelectedIntegrations(['circleback-mcp'])).toThrow(
      'Unknown integration selection: circleback-mcp',
    );
  });

  it('allows agent conversations when explicitly selected', () => {
    expect(
      resolveSelectedIntegrations(['agent-conversations']).map((integration) => integration.id),
    ).toEqual(['agent-conversations']);
  });

  it('rejects unknown integrations', () => {
    expect(() => resolveSelectedIntegrations(['unknown'])).toThrow(
      'Unknown integration selection: unknown',
    );
  });
});

describe('DEFAULT_REQUIRED_CONNECTIONS', () => {
  it('excludes agent conversations from the default connection gate', () => {
    expect(
      DEFAULT_REQUIRED_CONNECTIONS.map((connection) => connection.integrationId),
    ).not.toContain('agent-conversations');
  });
});

describe('oauthConnectionHints', () => {
  it('returns connection hints only for selected OAuth integrations', () => {
    expect(oauthConnectionHints(['notion', 'google-mail'])).toEqual([
      'notion/notion',
      'google-mail/gmail',
    ]);
  });

  it('omits integrations without OAuth connections', () => {
    expect(oauthConnectionHints(['agent-conversations'])).toEqual([]);
  });
});
