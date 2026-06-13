import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { jwt } from 'better-auth/plugins';
import { StatusMap } from 'elysia';
import { sql } from '#db/client.ts';
import { bunSqlAdapter } from '#lib/auth-adapter.ts';
import { env } from '#lib/env.ts';
import { createLogger } from '#lib/logger.ts';

export const SIGN_IN_PATH = '/sign-in';
export const CONSENT_PATH = '/consent';
export const MCP_SCOPE = 'mcp';
export const AUTH_BASE_PATH = '/api/auth';

export const OAUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access', MCP_SCOPE];

const logger = createLogger('better-auth');

function isWorkspaceEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${env.workspaceDomain}`);
}

export const auth = betterAuth({
  baseURL: env.publicUrl.href,
  basePath: AUTH_BASE_PATH,
  secret: env.betterAuthSecret,
  // better-auth runs on the same Bun.sql client as the rest of the brain, via a
  // custom adapter that targets its own `auth` schema (migration 0011).
  database: bunSqlAdapter(sql),
  trustedOrigins: [env.publicUrl.origin],
  socialProviders: {
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      prompt: 'select_account',
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: (user) => {
          if (!isWorkspaceEmail(user.email)) {
            throw new APIError('FORBIDDEN', {
              message: `Sign-in is restricted to @${env.workspaceDomain} accounts.`,
            });
          }
          return Promise.resolve();
        },
      },
    },
  },
  plugins: [
    jwt({
      jwt: {
        issuer: env.issuer,
        // The audience clients request is the resource mcp-use advertises in its
        // protected-resource metadata — the bare origin (the 401 challenge points
        // to the root document, whose `resource` is the origin, not `/mcp`).
        audience: env.publicUrl.origin,
      },
    }),
    oauthProvider({
      loginPage: SIGN_IN_PATH,
      consentPage: CONSENT_PATH,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // Accept both the origin (RFC 8707 strict clients follow the root PRM) and
      // the `/mcp` resource (the path-suffixed PRM) so either resolves a token.
      validAudiences: [env.publicUrl.origin, env.mcpResource.href],
      scopes: OAUTH_SCOPES,
    }),
  ],
});

// The OAuth plugin serialises errors (e.g. token-exchange failures) into 4xx JSON
// responses instead of routing them through `onAPIError`, and the handler is
// mounted inside mcp-use's Hono app, bypassing Elysia's error handler — so log the
// `{ error, error_description }` body of any failed auth response for observability.
export async function handleAuthRequest(request: Request): Promise<Response> {
  const response = await auth.handler(request);
  if (response.status >= StatusMap['Bad Request']) {
    const { pathname } = new URL(request.url);
    logger.error(
      `${request.method} ${pathname} ${response.status}: ${await response.clone().text()}`,
    );
  }
  return response;
}
