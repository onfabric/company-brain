declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL?: string;
      readonly PORT?: string;
      readonly BRAIN_API_KEY?: string;
      readonly MCP_OAUTH_ISSUER?: string;
      readonly MCP_OAUTH_JWKS_URL?: string;
      readonly MCP_RESOURCE?: string;
      readonly LOGTO_UPSTREAM_URL?: string;
      readonly LOGTO_M2M_CLIENT_ID?: string;
      readonly LOGTO_M2M_CLIENT_SECRET?: string;
    }
  }
}

const DEFAULT_PORT = '3010';

export type LogtoM2mCredentials = { clientId: string; clientSecret: string };

type Env = {
  databaseUrl: string;
  port: number;
  brainApiKey: string;
  // The issuer is minted by the authorization server and compared
  // byte-for-byte against the token's iss claim, so it stays a string: URL
  // normalization on our side would silently break validation. The resource is
  // our own identifier — every use derives from this one parsed value (via
  // .href), so it is consistently normalized everywhere.
  mcpOauthIssuer: string;
  mcpOauthJwksUrl: URL;
  mcpResource: URL;
  logtoUpstreamUrl: URL;
  // Optional: Logto's Management API credentials come from a one-time console
  // bootstrap, so the brain boots and serves /mcp without them — only the DCR
  // bridge (/oidc/register) needs them, and reports null as not-configured.
  logtoM2mCredentials: LogtoM2mCredentials | null;
};

function required(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredUrl(name: keyof NodeJS.ProcessEnv): URL {
  return new URL(required(name));
}

function optional(name: keyof NodeJS.ProcessEnv, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function logtoM2mCredentials(): LogtoM2mCredentials | null {
  const clientId = process.env.LOGTO_M2M_CLIENT_ID;
  const clientSecret = process.env.LOGTO_M2M_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function loadEnv(): Env {
  return {
    databaseUrl: required('DATABASE_URL'),
    port: Number(optional('PORT', DEFAULT_PORT)),
    brainApiKey: required('BRAIN_API_KEY'),
    mcpOauthIssuer: required('MCP_OAUTH_ISSUER'),
    mcpOauthJwksUrl: requiredUrl('MCP_OAUTH_JWKS_URL'),
    mcpResource: requiredUrl('MCP_RESOURCE'),
    logtoUpstreamUrl: requiredUrl('LOGTO_UPSTREAM_URL'),
    logtoM2mCredentials: logtoM2mCredentials(),
  };
}

export const env = loadEnv();
