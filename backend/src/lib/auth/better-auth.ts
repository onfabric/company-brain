import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { jwt } from 'better-auth/plugins';
import { StatusMap } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import { sql } from '#db/client.ts';
import { bunSqlAdapter } from '#lib/auth/adapter.ts';
import { env } from '#lib/env.ts';
import { createLogger } from '#lib/logger.ts';

// The sign-in and consent pages are routes of the dashboard SPA (served at the
// root origin), so better-auth redirects the OAuth/login flow into the SPA,
// which reads the appended authorize query client-side.
export const SIGN_IN_PATH = '/sign-in';
export const CONSENT_PATH = '/consent';
export const MCP_SCOPE = 'mcp';
export const AUTH_BASE_PATH = '/api/auth';

export const OAUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access', MCP_SCOPE];

const logger = createLogger('better-auth');

function isAllowedEmail(email: string): boolean {
  return (
    env.allowedDashboardAccountsEmailsRegex === null ||
    env.allowedDashboardAccountsEmailsRegex.test(email.toLowerCase())
  );
}

export const auth = betterAuth({
  baseURL: env.publicUrl.href,
  basePath: AUTH_BASE_PATH,
  secret: env.betterAuthSecret,
  // Catches errors better-auth routes through its error pipeline. OAuth-endpoint
  // failures bypass this (they are serialised into 4xx JSON), so those are logged
  // separately in `handleAuthRequest`.
  onAPIError: {
    onError(error) {
      const { status, body } = error as { status?: number; body?: Record<string, unknown> };
      logger.error(
        `api error ${status ?? ''} ${body?.error ?? ''}: ${body?.error_description ?? error}`,
      );
    },
  },
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
          if (!isAllowedEmail(user.email)) {
            throw new APIError('FORBIDDEN', {
              message: 'Sign-in is restricted to allowed accounts.',
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
      // Clients echo the root PRM `resource` (the origin) or the path-suffixed PRM
      // `resource` (`/mcp`). The origin is accepted both without a trailing slash
      // (`origin`) and with one (`href`), since clients that re-serialise it as a
      // URL send the slash form and better-auth matches audiences by exact string.
      validAudiences: [env.publicUrl.origin, env.publicUrl.href, env.mcpResource.href],
      scopes: OAUTH_SCOPES,
    }),
  ],
});

// The OAuth plugin serialises errors (e.g. token-exchange failures) into 4xx JSON
// responses instead of routing them through `onAPIError`, and the handler is
// mounted inside mcp-use's Hono app, bypassing Elysia's error handler — so log the
// `{ error, error_description }` body of any failed auth response here for
// observability (complementing the `onAPIError` hook above).
export async function handleAuthRequest(request: Request): Promise<Response> {
  const probe = request.clone();
  const response = await auth.handler(request);
  if (response.status >= StatusMap['Bad Request']) {
    const { pathname } = new URL(request.url);
    const resource = resourceParam(probe.headers.get('content-type'), await probe.text());
    logger.error(
      `${request.method} ${pathname} ${response.status}: ${await response.clone().text()}${resource}`,
    );
  }
  return response;
}

// The OAuth audience check rejects token requests whose `resource` is not a valid
// audience; surface that value (it is not a secret) to diagnose such failures.
function resourceParam(contentType: string | null, body: string): string {
  if (!contentType?.includes('form-urlencoded')) {
    return '';
  }
  const resource = new URLSearchParams(body).get('resource');
  return resource ? ` (resource=${resource})` : '';
}

export const SESSION_SECURITY_SCHEME = 'betterAuthSession';

export const sessionSecuritySchemes = {
  [SESSION_SECURITY_SCHEME]: {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
    description: 'better-auth session cookie set after signing in with Google',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

export async function hasValidSession(headers: Headers): Promise<boolean> {
  try {
    return (await auth.api.getSession({ headers })) !== null;
  } catch {
    return false;
  }
}
