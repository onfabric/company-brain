import { MCP_SCOPE, requiredEnv } from './env.ts';
import { findMcpScope, type LogtoApplication, managementApi } from './logto-management.ts';
import { parseRegistration, registrationResponse } from './register-client.ts';

// Reverse proxy in front of Logto's core endpoint that adds the one piece of
// the MCP authorization flow Logto lacks: Dynamic Client Registration
// (RFC 7591). Everything else passes through untouched, so the issuer and all
// token endpoints remain Logto's own.

const DEFAULT_PORT = 3001;

const upstream = requiredEnv('LOGTO_UPSTREAM');
const mcpResource = requiredEnv('MCP_RESOURCE');
const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

const OPENID_CONFIGURATION_PATH = '/oidc/.well-known/openid-configuration';
const REGISTER_PATH = '/oidc/register';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
};

async function serveMetadata(): Promise<Response> {
  const res = await fetch(`${upstream}${OPENID_CONFIGURATION_PATH}`);
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }
  const metadata = (await res.json()) as { issuer: string };
  return Response.json(
    { ...metadata, registration_endpoint: `${metadata.issuer}/register` },
    { headers: CORS_HEADERS },
  );
}

async function registerClient(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = parseRegistration(body as Parameters<typeof parseRegistration>[0]);
  if ('error' in parsed) {
    return Response.json(parsed, { status: 400, headers: CORS_HEADERS });
  }

  const application = await managementApi<LogtoApplication>('POST', 'applications', {
    name: parsed.clientName,
    type: 'Native',
    isThirdParty: true,
    oidcClientMetadata: {
      redirectUris: parsed.redirectUris,
      postLogoutRedirectUris: [],
    },
  });

  // Third-party apps may only request scopes granted to them; without this the
  // consent screen rejects the mcp scope.
  const scope = await findMcpScope(mcpResource, MCP_SCOPE);
  if (scope) {
    await managementApi('POST', `applications/${application.id}/user-consent-scopes`, {
      resourceScopes: [scope.id],
      userScopes: ['profile'],
    });
  }

  return Response.json(registrationResponse(application.id, parsed), {
    status: 201,
    headers: CORS_HEADERS,
  });
}

function proxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  // Identity encoding: fetch would transparently decompress, leaving stale
  // content-encoding/length headers on the passed-through response.
  headers.set('accept-encoding', 'identity');
  return fetch(new URL(url.pathname + url.search, upstream), {
    method: req.method,
    headers,
    body: req.body,
    redirect: 'manual',
  });
}

Bun.serve({
  port,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS' && pathname === REGISTER_PATH) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method === 'GET' && pathname === OPENID_CONFIGURATION_PATH) {
      return serveMetadata();
    }
    if (req.method === 'POST' && pathname === REGISTER_PATH) {
      try {
        return await registerClient(req);
      } catch (error) {
        console.error('registration failed:', error);
        return Response.json(
          { error: 'server_error', error_description: 'client registration failed' },
          { status: 500, headers: CORS_HEADERS },
        );
      }
    }
    return proxy(req);
  },
});

console.log(`logto dcr gateway listening on :${port}, upstream ${upstream}`);
