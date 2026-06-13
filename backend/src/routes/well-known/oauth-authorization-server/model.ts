import { t } from 'elysia';

// RFC 8414 Authorization Server Metadata. The brain advertises Google's real
// authorization_endpoint (so the client's browser logs in directly with
// Google) while pointing token/registration at itself, the OAuth proxy.
export const AuthorizationServerMetadataSchema = t.Object({
  issuer: t.String(),
  authorization_endpoint: t.String(),
  token_endpoint: t.String(),
  registration_endpoint: t.String(),
  jwks_uri: t.String(),
  scopes_supported: t.Array(t.String()),
  response_types_supported: t.Array(t.String()),
  grant_types_supported: t.Array(t.String()),
  code_challenge_methods_supported: t.Array(t.String()),
  token_endpoint_auth_methods_supported: t.Array(t.String()),
});
