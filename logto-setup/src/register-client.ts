// RFC 7591 Dynamic Client Registration, bridged onto Logto's Management API
// (Logto does not implement DCR itself). Only public clients with the
// authorization code + PKCE flow are accepted, which is what MCP clients use.

export type RegistrationRequest = {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
};

export type ParsedRegistration = {
  redirectUris: string[];
  clientName: string;
};

export type RegistrationError = { error: string; error_description: string };

export function parseRegistration(
  body: RegistrationRequest,
): ParsedRegistration | RegistrationError {
  const { redirect_uris: redirectUris, client_name: clientName } = body;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every((uri) => typeof uri === 'string' && isValidRedirectUri(uri))
  ) {
    return {
      error: 'invalid_redirect_uri',
      error_description: 'redirect_uris must be a non-empty array of valid http(s) URIs',
    };
  }
  if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== 'none') {
    return {
      error: 'invalid_client_metadata',
      error_description: 'only public clients (token_endpoint_auth_method "none") are supported',
    };
  }
  return {
    redirectUris,
    clientName: typeof clientName === 'string' && clientName.length > 0 ? clientName : 'MCP client',
  };
}

export function registrationResponse(clientId: string, parsed: ParsedRegistration) {
  return {
    client_id: clientId,
    client_name: parsed.clientName,
    redirect_uris: parsed.redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  };
}

function isValidRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}
