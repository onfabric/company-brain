import { Elysia, StatusMap } from 'elysia';
import { serveDashboard } from '#routes/dashboard/controller.ts';
import { knowledgeMcpService } from '#services/plugins.ts';

// The root mount catches every path Elysia does not route as a static `/api/*`
// endpoint. It first offers the request to the combined mcp-use + better-auth
// Hono app (the `/mcp` transport and its OAuth 2.1 surface — bearer
// verification, the 401 challenge, RFC 8414 / RFC 9728 discovery — plus
// better-auth's `/api/auth/*`); anything that app does not recognise (404) falls
// through to the dashboard SPA, so its client-side routes resolve on reload.
export const rootController = new Elysia().mount(async (request) => {
  const mcpResponse = await knowledgeMcpService.fetch(request);
  if (mcpResponse.status !== StatusMap['Not Found']) {
    return mcpResponse;
  }
  return serveDashboard();
});
