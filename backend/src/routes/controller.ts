import { Elysia, StatusMap } from 'elysia';
import { serveDashboard } from '#lib/dashboard.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// Real routes (the `/api/*` and `/internal/*` endpoints and the static asset
// files) are matched first by Elysia's router; this mount is the catch-all for
// the rest. It delegates to the foreign mcp-use + better-auth Hono app (the
// `/mcp` transport, its OAuth 2.1 discovery, and better-auth's `/api/auth/*`)
// without enumerating that app's routes: if the app does not claim the path it
// answers 404, and we serve the dashboard SPA shell instead so client-side routes
// resolve on reload. The catch-all has to be a `.mount()` — an Elysia `/*` route
// is greedy and would shadow even exact matches, whereas a mount runs only when
// no route matched.
export const rootController = new Elysia().mount(async (request) => {
  const fromMcp = await knowledgeMcpService.fetch(request);
  return fromMcp.status === StatusMap['Not Found'] ? serveDashboard() : fromMcp;
});
