import { Elysia, StatusMap } from 'elysia';
import { serveDashboard } from '#lib/dashboard.ts';
import { RoutePrefix } from '#routes/prefixes.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// Catch-all for the mcp-use + better-auth Hono app. Must be a `.mount()`, not a
// `/*` route: an Elysia wildcard route is greedy and would shadow exact matches,
// whereas a mount runs only when no other route matched.
export const rootController = new Elysia().mount(async (request) => {
  const fromMcp = await knowledgeMcpService.fetch(request);
  if (fromMcp.status !== StatusMap['Not Found']) {
    return fromMcp;
  }
  if (isStaticAssetsPath(new URL(request.url).pathname)) {
    return serveDashboard(request);
  }
  return Response.json({ error: 'Not Found' }, { status: StatusMap['Not Found'] });
});

function isStaticAssetsPath(pathname: string): boolean {
  return !pathname.startsWith(RoutePrefix.Api) && !pathname.startsWith(RoutePrefix.Internal);
}
