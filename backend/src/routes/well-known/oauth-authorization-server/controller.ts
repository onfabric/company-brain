import { Elysia } from 'elysia';
import { AUTH_BASE_PATH, auth } from '#lib/auth.ts';
import { PUBLIC_CORS_MACRO_NAME, publicCors } from '#lib/public-cors.ts';

const OPENID_CONFIG_PATH = `${AUTH_BASE_PATH}/.well-known/openid-configuration`;

// RFC 8414 Authorization Server Metadata. better-auth's oidc-provider only
// serves the OpenID `openid-configuration` document, but MCP clients probe the
// OAuth `oauth-authorization-server` path (derived from the issuer in the
// protected-resource metadata) first. Re-serve the same document there.
export const oauthAuthorizationServerController = new Elysia().use(publicCors).get(
  `${AUTH_BASE_PATH}/.well-known/oauth-authorization-server`,
  async ({ request }) => {
    const origin = new URL(request.url).origin;
    const response = await auth.handler(new Request(`${origin}${OPENID_CONFIG_PATH}`));
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  },
  { [PUBLIC_CORS_MACRO_NAME]: true, detail: { hide: true } },
);
