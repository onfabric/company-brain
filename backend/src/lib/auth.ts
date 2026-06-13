import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { jwt, oidcProvider } from 'better-auth/plugins';
import { Pool } from 'pg';
import { env, WORKSPACE_DOMAIN } from '#lib/env.ts';

export const SIGN_IN_PATH = '/sign-in';
export const CONSENT_PATH = '/consent';
export const MCP_SCOPE = 'mcp';

// better-auth speaks Kysely/pg, while the rest of the brain uses Bun.sql. They
// share the same connection string and database; better-auth gets its own pool
// so its adapter stays self-contained. Its tables live in the `brain` schema
// (created by migration 0011), reached via the connection's search_path since
// better-auth issues unqualified queries.
const pool = new Pool({
  connectionString: env.databaseUrl,
  options: '-c search_path=brain',
});

function isWorkspaceEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${WORKSPACE_DOMAIN}`);
}

export const auth = betterAuth({
  baseURL: env.publicUrl.href,
  basePath: '/api/auth',
  secret: env.betterAuthSecret,
  database: pool,
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
  ],
});

export type Auth = typeof auth;
