import { describe, expect, it } from 'bun:test';

import {
  INTEGRATIONS,
  parseConnectionResponse,
  parseConnectionsResponse,
} from './nango-resources.js';

const connection = {
  connection_id: 'local-agent-sync',
  provider_config_key: 'agent-conversations',
};

describe('INTEGRATIONS', () => {
  it('marks Circleback as an MCP OAuth integration', () => {
    const circleback = INTEGRATIONS.find((integration) => integration.id === 'circleback-mcp');

    expect(circleback).toMatchObject({
      provider: 'circleback-mcp',
      authType: 'MCP_OAUTH2',
    });
  });
});

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
