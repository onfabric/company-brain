import { describe, expect, it } from 'bun:test';

import {
  parseConnectionResponse,
  parseConnectionsResponse,
  parseIntegrationSelection,
  resolveSelectedIntegrations,
  resolveSelectedSyncs,
} from './nango-resources.js';

const connection = {
  connection_id: 'local-agent-sync',
  provider_config_key: 'agent-conversations',
};

describe('parseConnectionResponse', () => {
  it('accepts public connection responses', async () => {
    const parsed = await parseConnectionResponse(
      new Response(JSON.stringify(connection)),
      'agent-conversations',
      'local-agent-sync',
    );

    expect(parsed).toEqual(connection);
  });

  it('accepts wrapped connection responses', async () => {
    const parsed = await parseConnectionResponse(
      new Response(JSON.stringify({ data: connection })),
      'agent-conversations',
      'local-agent-sync',
    );

    expect(parsed).toEqual(connection);
  });

  it('rejects responses without connection data', async () => {
    await expect(
      parseConnectionResponse(
        new Response(JSON.stringify({ error: { code: 'not_found' } })),
        'agent-conversations',
        'local-agent-sync',
      ),
    ).rejects.toThrow('Nango returned no connection data for agent-conversations/local-agent-sync');
  });
});

describe('parseIntegrationSelection', () => {
  it('parses comma-separated integration ids', () => {
    expect(parseIntegrationSelection('notion, slack')).toEqual(['notion', 'slack']);
  });

  it('returns undefined for empty input', () => {
    expect(parseIntegrationSelection(' , ')).toBeUndefined();
  });
});

describe('resolveSelectedSyncs', () => {
  it('returns default syncs when no selection is supplied', () => {
    expect(resolveSelectedSyncs(undefined).map((sync) => sync.integrationId)).toContain('notion');
  });

  it('excludes manually managed syncs from the default selection', () => {
    expect(resolveSelectedSyncs(undefined).map((sync) => sync.integrationId)).not.toContain(
      'circleback-mcp',
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

  it('rejects unknown integrations', () => {
    expect(() => resolveSelectedIntegrations(['unknown'])).toThrow(
      'Unknown integration selection: unknown',
    );
  });
});

describe('parseConnectionsResponse', () => {
  it('accepts public connection list responses', async () => {
    const parsed = await parseConnectionsResponse(
      new Response(JSON.stringify({ connections: [connection] })),
      'agent-conversations',
    );

    expect(parsed).toEqual({ connections: [connection] });
  });

  it('rejects responses without a connection list', async () => {
    await expect(
      parseConnectionsResponse(
        new Response(JSON.stringify({ error: { code: 'not_found' } })),
        'agent-conversations',
      ),
    ).rejects.toThrow('Nango returned no connection list for agent-conversations');
  });
});
