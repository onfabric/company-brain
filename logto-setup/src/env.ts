export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';
export const MCP_SCOPE = 'mcp';
