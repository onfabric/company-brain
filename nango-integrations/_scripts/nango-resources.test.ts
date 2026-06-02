import { describe, expect, it } from 'bun:test';

import { parseConnectionResponse } from './nango-resources.js';

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
