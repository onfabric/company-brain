declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL?: string;
      readonly PORT?: string;
      readonly BRAIN_API_KEY?: string;
      readonly BRAIN_PUBLIC_URL?: string;
      readonly BETTER_AUTH_SECRET?: string;
      readonly GOOGLE_CLIENT_ID?: string;
      readonly GOOGLE_CLIENT_SECRET?: string;
      readonly ALLOWED_DASHBOARD_ACCOUNTS_EMAILS_REGEX?: string;
    }
  }
}

const DEFAULT_PORT = '3010';
const DEFAULT_PUBLIC_URL = `http://localhost:${DEFAULT_PORT}`;

type Env = {
  databaseUrl: string;
  port: number;
  brainApiKey: string;
  // Public origin the brain is reachable at — the OAuth issuer, the JWKS host,
  // and the base for every discovery document. Parsed once so every derivation
  // (issuer, resource, callback) is consistently normalized.
  publicUrl: URL;
  // The MCP resource identifier: the audience better-auth stamps on access
  // tokens and the `resource` mcp-use advertises in RFC 9728 metadata.
  mcpResource: URL;
  // The brain's own OAuth issuer (the better-auth base). mcp-use derives the
  // provider's `authURL`/JWKS from it and verifies the token `iss` against it.
  issuer: string;
  // Where the issuer publishes its JWKS (`<issuer>/jwks`); mcp-use fetches it.
  jwksUrl: URL;
  betterAuthSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  allowedDashboardAccountsEmailsRegex: RegExp | null;
};

function required(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: keyof NodeJS.ProcessEnv, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function loadEnv(): Env {
  const publicUrl = new URL(optional('BRAIN_PUBLIC_URL', DEFAULT_PUBLIC_URL));
  return {
    databaseUrl: required('DATABASE_URL'),
    port: Number(optional('PORT', DEFAULT_PORT)),
    brainApiKey: required('BRAIN_API_KEY'),
    publicUrl,
    mcpResource: new URL('/mcp', publicUrl),
    issuer: new URL('/api/auth', publicUrl).href,
    jwksUrl: new URL('/api/auth/jwks', publicUrl),
    betterAuthSecret: required('BETTER_AUTH_SECRET'),
    googleClientId: required('GOOGLE_CLIENT_ID'),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
    allowedDashboardAccountsEmailsRegex: process.env.ALLOWED_DASHBOARD_ACCOUNTS_EMAILS_REGEX
      ? new RegExp(process.env.ALLOWED_DASHBOARD_ACCOUNTS_EMAILS_REGEX)
      : null,
  };
}

export const env = loadEnv();
