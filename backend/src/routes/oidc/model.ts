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

// Logto's discovery document passed through with our registration endpoint
// added; only the fields this service guarantees are pinned, the rest is
// upstream passthrough.
export const OpenidConfigurationResponseSchema = t.Object(
  {
    issuer: t.String(),
    registration_endpoint: t.String(),
  },
  { additionalProperties: true },
);
