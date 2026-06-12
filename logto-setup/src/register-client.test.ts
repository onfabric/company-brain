import { describe, expect, it } from 'bun:test';
import { parseRegistration, registrationResponse } from './register-client.ts';

describe('parseRegistration', () => {
  it('accepts https and localhost redirect uris', () => {
    const parsed = parseRegistration({
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback', 'http://localhost:33418/callback'],
      client_name: 'Claude',
    });
    expect(parsed).toEqual({
      redirectUris: ['https://claude.ai/api/mcp/auth_callback', 'http://localhost:33418/callback'],
      clientName: 'Claude',
    });
  });

  it('rejects missing or non-https remote redirect uris', () => {
    for (const redirectUris of [undefined, [], ['http://evil.example.com/cb'], ['not a url']]) {
      const parsed = parseRegistration({ redirect_uris: redirectUris });
      expect(parsed).toHaveProperty('error', 'invalid_redirect_uri');
    }
  });

  it('rejects confidential clients', () => {
    const parsed = parseRegistration({
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
    expect(parsed).toHaveProperty('error', 'invalid_client_metadata');
  });

  it('defaults the client name', () => {
    const parsed = parseRegistration({ redirect_uris: ['https://claude.ai/cb'] });
    expect(parsed).toHaveProperty('clientName', 'MCP client');
  });

  it('shapes the RFC 7591 response', () => {
    const response = registrationResponse('app123', {
      redirectUris: ['https://claude.ai/cb'],
      clientName: 'Claude',
    });
    expect(response.client_id).toBe('app123');
    expect(response.token_endpoint_auth_method).toBe('none');
    expect(response.grant_types).toEqual(['authorization_code', 'refresh_token']);
  });
});
