import { Elysia } from 'elysia';
import { serveDashboard } from '#lib/dashboard.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// The MCP transport and its OAuth 2.1 surface (bearer verification, the 401
// challenge, RFC 8414 / RFC 9728 discovery) plus better-auth's `/api/auth/*` live
// in one foreign Hono app (mcp-use + better-auth fused). Forward its fixed paths
// to it as explicit routes so they are matched ahead of the catch-all.
const forwardToMcp = ({ request }: { request: Request }) => knowledgeMcpService.fetch(request);

// Everything that matches no route — the dashboard's root and its client-side
// routes — falls through to the SPA shell. This fallback is a `.mount()`, not a
// `/*` route, on purpose: an Elysia wildcard route is greedy and would shadow
// even exact matches, whereas a mount runs only when no route matched.
export const rootController = new Elysia()
  .all('/mcp', forwardToMcp)
  .all('/sse', forwardToMcp)
  .all('/.well-known/*', forwardToMcp)
  .all('/api/auth', forwardToMcp)
  .all('/api/auth/*', forwardToMcp)
  .mount(() => serveDashboard());
