declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL?: string;
      readonly PORT?: string;
      readonly BRAIN_API_KEY?: string;
      readonly MCP_OAUTH_ISSUER?: string;
      readonly MCP_OAUTH_JWKS_URL?: string;
      readonly MCP_RESOURCE?: string;
    }
  }
}

const DEFAULT_PORT = 3010;

type Env = {
  databaseUrl: string;
  port: number;
  brainApiKey: string;
};

function loadEnv(): Env {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  const brainApiKey = process.env.BRAIN_API_KEY;
  if (!brainApiKey) {
    throw new Error('Missing required environment variable: BRAIN_API_KEY');
  }

  return {
    databaseUrl,
    port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,
    brainApiKey,
  };
}

export const env = loadEnv();

type McpOauthEnv = {
  issuer: string;
  jwksUrl: string;
  resource: string;
};

// Read lazily (unlike `env`): OAuth is optional, and tests enable it per file
// after this module is already imported.
export function mcpOauthEnv(): McpOauthEnv | null {
  const issuer = process.env.MCP_OAUTH_ISSUER;
  if (!issuer) {
    return null;
  }
  const resource = process.env.MCP_RESOURCE;
  if (!resource) {
    throw new Error('MCP_RESOURCE is required when MCP_OAUTH_ISSUER is set');
  }
  return {
    issuer,
    jwksUrl: process.env.MCP_OAUTH_JWKS_URL ?? `${issuer}/protocol/openid-connect/certs`,
    resource,
  };
}
