import { Elysia } from 'elysia';
import { KnowledgeMcpServicePlugin } from '#services/plugins.ts';

// mcp-use's prepared handler owns the whole OAuth 2.1 surface: the `/mcp`
// transport (every method), bearer verification with the 401 challenge, and the
// RFC 8414 / RFC 9728 discovery documents. Elysia routes its own paths and
// forwards exactly these to that handler — `parse: 'none'` keeps the request
// body intact for mcp-use to read.
const delegate = ({
  knowledgeMcpService,
  request,
}: {
  knowledgeMcpService: { handleRequest(request: Request): Promise<Response> };
  request: Request;
}) => knowledgeMcpService.handleRequest(request);

export const mcpController = new Elysia()
  .use(KnowledgeMcpServicePlugin)
  .post('/mcp', delegate, { parse: 'none' })
  .get('/mcp', delegate)
  .delete('/mcp', delegate)
  .get('/.well-known/oauth-authorization-server', delegate, { detail: { hide: true } })
  .get('/.well-known/openid-configuration', delegate, { detail: { hide: true } })
  .get('/.well-known/oauth-protected-resource', delegate, { detail: { hide: true } })
  .get('/.well-known/oauth-protected-resource/mcp', delegate, { detail: { hide: true } });
