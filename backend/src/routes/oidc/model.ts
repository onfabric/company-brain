import { t } from 'elysia';

export const ClientRegistrationRequestSchema = t.Object(
  {
    redirect_uris: t.Array(t.String(), { minItems: 1 }),
    client_name: t.Optional(t.String()),
    // Only public clients (PKCE, no secret) are supported, which is what MCP
    // clients are.
    token_endpoint_auth_method: t.Optional(t.Literal('none')),
    grant_types: t.Optional(t.Array(t.String())),
    response_types: t.Optional(t.Array(t.String())),
    scope: t.Optional(t.String()),
  },
  { additionalProperties: true },
);

export const ClientRegistrationResponseSchema = t.Object({
  client_id: t.String(),
  client_name: t.String(),
  redirect_uris: t.Array(t.String()),
  token_endpoint_auth_method: t.Literal('none'),
  grant_types: t.Array(t.String()),
  response_types: t.Array(t.String()),
});

export const ClientRegistrationErrorSchema = t.Object({
  error: t.String(),
  error_description: t.String(),
});

export const NoContentResponseSchema = t.Undefined();

// RFC 8693-style token exchange request the public MCP client posts to the
// brain's proxied /token endpoint. Any provider-specific extra fields (e.g.
// PKCE's code_verifier) pass through to Google untouched.
export const TokenRequestSchema = t.Object(
  {
    grant_type: t.String(),
    code: t.Optional(t.String()),
    redirect_uri: t.Optional(t.String()),
    code_verifier: t.Optional(t.String()),
    refresh_token: t.Optional(t.String()),
    client_id: t.Optional(t.String()),
    scope: t.Optional(t.String()),
  },
  { additionalProperties: true },
);

// Google's token response passed straight back to the client; only the field
// every successful exchange guarantees is pinned, the rest is passthrough.
export const TokenResponseSchema = t.Object(
  {
    access_token: t.String(),
  },
  { additionalProperties: true },
);

export const TokenErrorSchema = t.Object(
  {
    error: t.String(),
  },
  { additionalProperties: true },
);
