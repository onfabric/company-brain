import { Elysia, StatusMap } from 'elysia';
import { serveDashboard } from '#lib/dashboard.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// Real routes (the `/api/*` and `/internal/*` endpoints, the static asset files)
// are matched first by Elysia's router. This is the fallback for everything else
// — and it must be a `.mount()`, not a `/*` route: an Elysia wildcard route is
// greedy and would shadow even those exact matches, whereas a mount only runs
// when no route matched. The mounted handler is itself a small cascade: hand the
// request to the combined mcp-use + better-auth Hono app (the `/mcp` transport
// and its OAuth 2.1 surface — bearer verification, the 401 challenge, RFC 8414 /
// RFC 9728 discovery — plus better-auth's `/api/auth/*`), and when that app
// reports it has no such route (404) serve the dashboard SPA shell instead, so
// client-side routes resolve on reload.
export const rootController = new Elysia().mount(async (request) => {
  const fromMcp = await knowledgeMcpService.fetch(request);
  return fromMcp.status === StatusMap['Not Found'] ? serveDashboard() : fromMcp;
});
