import { Elysia, StatusMap } from 'elysia';
import { serveDashboard } from '#lib/dashboard.ts';
import { API_PREFIX } from '#routes/api/controller.ts';
import { INTERNAL_PREFIX } from '#routes/internal/controller.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// Catch-all for the mcp-use + better-auth Hono app. Must be a `.mount()`, not a
// `/*` route: an Elysia wildcard route is greedy and would shadow exact matches,
// whereas a mount runs only when no other route matched.
export const rootController = new Elysia().mount(async (request) => {
  const fromMcp = await knowledgeMcpService.fetch(request);
  if (fromMcp.status !== StatusMap['Not Found']) {
    return fromMcp;
  }
  // Nothing matched. An /api or /internal request gets a JSON 404 (the API's
  // error shape — a clear contract for clients); anything else is a browser
  // navigation that the dashboard SPA shell resolves.
  const { pathname } = new URL(request.url);
  if (pathname.startsWith(API_PREFIX) || pathname.startsWith(INTERNAL_PREFIX)) {
    return Response.json({ error: 'Not Found' }, { status: StatusMap['Not Found'] });
  }
  return serveDashboard(request);
});
