import { GOOGLE_TOKEN_ENDPOINT, GOOGLE_TOKENINFO_ENDPOINT } from '#lib/google-oauth.ts';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL?: string;
      readonly PORT?: string;
      readonly BRAIN_API_KEY?: string;
      readonly GOOGLE_CLIENT_ID?: string;
      readonly GOOGLE_CLIENT_SECRET?: string;
      readonly BRAIN_PUBLIC_URL?: string;
      readonly GOOGLE_WORKSPACE_DOMAIN?: string;
      readonly GOOGLE_TOKEN_ENDPOINT?: string;
      readonly GOOGLE_TOKENINFO_ENDPOINT?: string;
    }
  }
}

const DEFAULT_PORT = 3010;
const DEFAULT_WORKSPACE_DOMAIN = 'onfabric.io';

type Env = {
  databaseUrl: string;
  port: number;
  brainApiKey: string;
  // The brain is Google's single pre-registered OAuth client; these are
  // injected into the proxied /token exchange the public MCP client cannot
  // hold itself.
  googleClientId: string;
  googleClientSecret: string;
  // Origin the brain serves its OAuth metadata, /token, and /register on; it is
  // the issuer advertised to MCP clients.
  brainPublicUrl: URL;
  // Restricts MCP access to a single Google Workspace domain (hd param on
  // authorize, verified on the token's hosted-domain/email claim).
  googleWorkspaceDomain: string;
  // Server-side Google endpoints the proxy calls; overridable so tests can
  // point them at a local mock.
  googleTokenEndpoint: string;
  googleTokeninfoEndpoint: string;
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

function loadEnv(): Env {
  return {
    databaseUrl: required('DATABASE_URL'),
    port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,
    brainApiKey: required('BRAIN_API_KEY'),
    googleClientId: required('GOOGLE_CLIENT_ID'),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
    brainPublicUrl: requiredUrl('BRAIN_PUBLIC_URL'),
    googleWorkspaceDomain: process.env.GOOGLE_WORKSPACE_DOMAIN || DEFAULT_WORKSPACE_DOMAIN,
    googleTokenEndpoint: process.env.GOOGLE_TOKEN_ENDPOINT || GOOGLE_TOKEN_ENDPOINT,
    googleTokeninfoEndpoint: process.env.GOOGLE_TOKENINFO_ENDPOINT || GOOGLE_TOKENINFO_ENDPOINT,
  };
}

export const env = loadEnv();
