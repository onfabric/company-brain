import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import { MethodNotAllowedResponseSchema } from '#routes/mcp/model.ts';
import { KnowledgeMcpServicePlugin } from '#services/plugins.ts';

export const mcpController = new Elysia()
  .use(KnowledgeMcpServicePlugin)
  .use(apiKeyAuth)
  .post(
    '/mcp',
    ({ body, knowledgeMcpService, request }) => knowledgeMcpService.handleRequest(request, body),
    { [REQUIRE_API_KEY_MACRO_NAME]: true },
  )
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
