import { Elysia, type Static, StatusMap } from 'elysia';
import { env } from '#lib/env.ts';
import {
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_JWKS_URI,
  GOOGLE_SCOPES_SUPPORTED,
} from '#lib/google-oauth.ts';
import { PUBLIC_CORS_MACRO_NAME, publicCors } from '#lib/public-cors.ts';
import { AuthorizationServerMetadataSchema } from '#routes/well-known/oauth-authorization-server/model.ts';

// The OAuth proxy: authorize goes straight to Google (the client's browser
// logs in there), while token + registration point at the brain, which holds
// the single Google client_id/secret the public MCP client cannot. The brain
// is the issuer; jwks_uri is Google's (for clients that verify id_tokens).
const METADATA: Static<typeof AuthorizationServerMetadataSchema> = {
  issuer: env.brainPublicUrl.origin,
  authorization_endpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
  token_endpoint: new URL('/token', env.brainPublicUrl).href,
  registration_endpoint: new URL('/oidc/register', env.brainPublicUrl).href,
  jwks_uri: GOOGLE_JWKS_URI,
  scopes_supported: [...GOOGLE_SCOPES_SUPPORTED],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
};

export const oauthAuthorizationServerController = new Elysia()
  .use(publicCors)
  .get('/.well-known/oauth-authorization-server', () => METADATA, {
    [PUBLIC_CORS_MACRO_NAME]: true,
    response: { [StatusMap.OK]: AuthorizationServerMetadataSchema },
    detail: { hide: true },
  })
  .get('/.well-known/openid-configuration', () => METADATA, {
    [PUBLIC_CORS_MACRO_NAME]: true,
    response: { [StatusMap.OK]: AuthorizationServerMetadataSchema },
    detail: { hide: true },
  });
