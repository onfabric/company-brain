export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requiredUrlEnv(name: string): URL {
  return new URL(requiredEnv(name));
}

export type M2mCredentials = { clientId: string; clientSecret: string };

// Optional: absent until the one-time console bootstrap, so provisioning skips
// rather than failing the deploy (mirrors the brain's DCR-unavailable state).
export function m2mCredentials(): M2mCredentials | null {
  const clientId = process.env.LOGTO_M2M_CLIENT_ID;
  const clientSecret = process.env.LOGTO_M2M_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// Fixed resource indicator (token audience) of Logto's built-in Management
// API for the OSS `default` tenant — an identifier, never fetched as a URL.
export const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';
export const MCP_SCOPE = 'mcp';
