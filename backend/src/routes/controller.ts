import { Elysia, StatusMap } from 'elysia';
import { serveDashboard } from '#lib/dashboard.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// Catch-all for the mcp-use + better-auth Hono app. Must be a `.mount()`, not a
// `/*` route: an Elysia wildcard route is greedy and would shadow exact matches,
// whereas a mount runs only when no other route matched.
export const rootController = new Elysia().mount(async (request) => {
  const fromMcp = await knowledgeMcpService.fetch(request);
  // The Hono app answers 404 for paths it does not own; serve the SPA there.
  if (fromMcp.status === StatusMap['Not Found']) {
    return serveDashboard(request);
  }
  return fromMcp;
});
