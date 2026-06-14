import { describe, expect, it } from 'bun:test';
import { bootstrappedConnectionIntegrationIds } from './nango.ts';

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
