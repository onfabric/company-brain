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

// Fixed resource indicator (token audience) of Logto's built-in Management
// API for the OSS `default` tenant — an identifier, never fetched as a URL.
export const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';
export const MCP_SCOPE = 'mcp';
