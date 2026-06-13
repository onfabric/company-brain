import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { jwt, oidcProvider, openAPI } from 'better-auth/plugins';
import { sql } from '#db/client.ts';
import { bunSqlAdapter } from '#lib/auth-adapter.ts';
import { env, WORKSPACE_DOMAIN } from '#lib/env.ts';

export const SIGN_IN_PATH = '/sign-in';
export const CONSENT_PATH = '/consent';
export const MCP_SCOPE = 'mcp';
export const AUTH_BASE_PATH = '/api/auth';

function isWorkspaceEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${WORKSPACE_DOMAIN}`);
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
              message: `Sign-in is restricted to @${WORKSPACE_DOMAIN} accounts.`,
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
        audience: env.mcpResource.href,
      },
    }),
    oidcProvider({
      loginPage: SIGN_IN_PATH,
      consentPage: CONSENT_PATH,
      allowDynamicClientRegistration: true,
      useJWTPlugin: true,
      scopes: ['openid', 'profile', 'email', 'offline_access', MCP_SCOPE],
    }),
    openAPI(),
  ],
});

export type Auth = typeof auth;
