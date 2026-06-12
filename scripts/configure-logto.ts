#!/usr/bin/env bun
// Idempotently provisions Logto for MCP via its Management API: the API
// resource (token audience), its `mcp` scope, and a pre-registered third-party
// app for MCP clients (Logto has no Dynamic Client Registration, so clients
// cannot self-register).
//
// One-time bootstrap (Logto's Management API has no other way in): in the
// admin console (http://localhost:3002) create a Machine-to-machine app,
// assign it the "Logto Management API access" role, and put its credentials in
// .env as LOGTO_M2M_CLIENT_ID / LOGTO_M2M_CLIENT_SECRET.
//
// Usage: bun scripts/configure-logto.ts

const endpoint = required('LOGTO_ENDPOINT', `http://localhost:${process.env.LOGTO_PORT ?? '3001'}`);
const m2mClientId = required('LOGTO_M2M_CLIENT_ID');
const m2mClientSecret = required('LOGTO_M2M_CLIENT_SECRET');
const mcpResource = required('MCP_RESOURCE', 'http://localhost:3010/mcp');
const redirectUris = (
  process.env.LOGTO_MCP_CLIENT_REDIRECT_URIS ?? 'https://claude.ai/api/mcp/auth_callback'
).split(',');

const MCP_SCOPE = 'mcp';
const MCP_CLIENT_APP_NAME = 'MCP clients';
const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function managementToken(): Promise<string> {
  const res = await fetch(`${endpoint}/oidc/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${m2mClientId}:${m2mClientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource: MANAGEMENT_API_RESOURCE,
      scope: 'all',
    }),
  });
  if (!res.ok) {
    throw new Error(`token request failed (${res.status}): ${await res.text()}`);
  }
  return ((await res.json()) as { access_token: string }).access_token;
}

const token = await managementToken();

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${endpoint}/api/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} /api/${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

type Resource = { id: string; indicator: string };
type Scope = { id: string; name: string };
type Application = { id: string; name: string; isThirdParty: boolean };

const resources = await api<Resource[]>('GET', 'resources');
let resource = resources.find((r) => r.indicator === mcpResource);
if (resource) {
  console.log(`api resource exists: ${mcpResource}`);
} else {
  resource = await api<Resource>('POST', 'resources', {
    name: 'Company Brain MCP',
    indicator: mcpResource,
  });
  console.log(`created api resource: ${mcpResource}`);
}

const scopes = await api<Scope[]>('GET', `resources/${resource.id}/scopes`);
let scope = scopes.find((s) => s.name === MCP_SCOPE);
if (scope) {
  console.log(`scope exists: ${MCP_SCOPE}`);
} else {
  scope = await api<Scope>('POST', `resources/${resource.id}/scopes`, {
    name: MCP_SCOPE,
    description: 'Access the Company Brain knowledge base',
  });
  console.log(`created scope: ${MCP_SCOPE}`);
}

const applications = await api<Application[]>('GET', 'applications');
let app = applications.find((a) => a.name === MCP_CLIENT_APP_NAME);
if (app) {
  console.log(`application exists: ${MCP_CLIENT_APP_NAME}`);
} else {
  app = await api<Application>('POST', 'applications', {
    name: MCP_CLIENT_APP_NAME,
    type: 'Native',
    isThirdParty: true,
    oidcClientMetadata: {
      redirectUris,
      postLogoutRedirectUris: [],
    },
  });
  console.log(`created third-party application: ${MCP_CLIENT_APP_NAME}`);
}

// Third-party apps may only request scopes granted to them; without this the
// consent screen rejects the `mcp` scope.
await api('POST', `applications/${app.id}/user-consent-scopes`, {
  resourceScopes: [scope.id],
});
console.log(`granted consent scope ${MCP_SCOPE} to ${MCP_CLIENT_APP_NAME}`);

console.log(`\nDone. Configure MCP clients with client_id: ${app.id}`);
