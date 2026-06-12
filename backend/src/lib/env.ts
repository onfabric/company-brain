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

const DEFAULT_PORT = 3010;

type Env = {
  databaseUrl: string;
  port: number;
  brainApiKey: string;
  mcpOauthIssuer: string;
  mcpOauthJwksUrl: string;
  mcpResource: string;
  logtoUpstreamUrl: string;
  logtoM2mClientId: string;
  logtoM2mClientSecret: string;
};

function required(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadEnv(): Env {
  return {
    databaseUrl: required('DATABASE_URL'),
    port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,
    brainApiKey: required('BRAIN_API_KEY'),
    mcpOauthIssuer: required('MCP_OAUTH_ISSUER'),
    mcpOauthJwksUrl: required('MCP_OAUTH_JWKS_URL'),
    mcpResource: required('MCP_RESOURCE'),
    logtoUpstreamUrl: required('LOGTO_UPSTREAM_URL'),
    logtoM2mClientId: required('LOGTO_M2M_CLIENT_ID'),
    logtoM2mClientSecret: required('LOGTO_M2M_CLIENT_SECRET'),
  };
}

export const env = loadEnv();
