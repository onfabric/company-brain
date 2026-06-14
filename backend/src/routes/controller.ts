import { Elysia, StatusMap } from 'elysia';
import { serveDashboard } from '#lib/dashboard.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// Catch-all for the mcp-use + better-auth Hono app. Must be a `.mount()`, not a
// `/*` route: an Elysia wildcard route is greedy and would shadow exact matches,
// whereas a mount runs only when no other route matched.
export const rootController = new Elysia().mount(async (request) => {
  const fromMcp = await knowledgeMcpService.fetch(request);
  if (fromMcp.status !== StatusMap['Not Found']) {
    return fromMcp;
  }
  // The Hono app answers 404 for paths it does not own. Unknown API paths keep
  // that 404 (a clear contract for clients calling the API); only navigation
  // paths fall back to the dashboard SPA shell.
  const { pathname } = new URL(request.url);
  if (pathname.startsWith('/api') || pathname.startsWith('/internal')) {
    return fromMcp;
  }
  return serveDashboard(request);
});
