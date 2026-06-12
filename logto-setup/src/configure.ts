import { MCP_SCOPE, requiredEnv, requiredUrlEnv } from './env.ts';
import {
  findMcpScope,
  type LogtoResource,
  type LogtoScope,
  managementApi,
} from './logto-management.ts';

// One-shot, idempotent Logto provisioning, run on every `docker compose up`:
// the MCP API resource and scope, and a dev user for the local OAuth flow.
// Requires the M2M credentials from the one-time console bootstrap (see
// .env.example).

const upstream = requiredUrlEnv('LOGTO_UPSTREAM_URL');
const mcpResource = requiredEnv('MCP_RESOURCE');

const READY_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 2_000;

async function waitForLogto(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (true) {
    try {
      const res = await fetch(new URL('oidc/.well-known/openid-configuration', upstream));
      if (res.ok) {
        return;
      }
    } catch {}
    if (Date.now() > deadline) {
      throw new Error(`logto not ready after ${READY_TIMEOUT_MS}ms`);
    }
    await Bun.sleep(READY_POLL_MS);
  }
}

async function ensureMcpResource(): Promise<void> {
  const resources = await managementApi<LogtoResource[]>('GET', 'resources');
  let resource = resources.find((r) => r.indicator === mcpResource);
  if (!resource) {
    resource = await managementApi<LogtoResource>('POST', 'resources', {
      name: 'Company Brain MCP',
      indicator: mcpResource,
    });
    console.log(`created api resource ${mcpResource}`);
  }
  const scope = await findMcpScope(mcpResource, MCP_SCOPE);
  if (!scope) {
    await managementApi<LogtoScope>('POST', `resources/${resource.id}/scopes`, {
      name: MCP_SCOPE,
      description: 'Access the Company Brain knowledge base',
    });
    console.log(`created scope ${MCP_SCOPE}`);
  }
}

async function ensureDevUser(): Promise<void> {
  const password = process.env.LOGTO_DEV_USER_PASSWORD;
  if (!password) {
    return;
  }
  const { users } = { users: await managementApi<{ id: string }[]>('GET', 'users?search=dev') };
  if (users.length === 0) {
    await managementApi('POST', 'users', { username: 'dev', password });
    console.log('created dev user');
  }
}

await waitForLogto();
await ensureMcpResource();
await ensureDevUser();
console.log('logto configuration complete');
