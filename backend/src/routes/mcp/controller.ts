import { Elysia, StatusMap } from 'elysia';
import { mcpAuth, REQUIRE_MCP_AUTH_MACRO_NAME } from '#lib/mcp-oauth.ts';
import { MethodNotAllowedResponseSchema } from '#routes/mcp/model.ts';
import { KnowledgeMcpServicePlugin } from '#services/plugins.ts';

export const mcpController = new Elysia()
  .use(KnowledgeMcpServicePlugin)
  .use(mcpAuth)
  .post('/mcp', ({ knowledgeMcpService, request }) => knowledgeMcpService.handleRequest(request), {
    [REQUIRE_MCP_AUTH_MACRO_NAME]: true,
    parse: 'none',
  })
  .get(
    '/mcp',
    ({ status }) => status(StatusMap['Method Not Allowed'], { error: 'Method Not Allowed' }),
    {
      response: { [StatusMap['Method Not Allowed']]: MethodNotAllowedResponseSchema },
    },
  )
  .delete(
    '/mcp',
    ({ status }) => status(StatusMap['Method Not Allowed'], { error: 'Method Not Allowed' }),
    {
      response: { [StatusMap['Method Not Allowed']]: MethodNotAllowedResponseSchema },
    },
  );
