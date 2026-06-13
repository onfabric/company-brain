import { API_KEY_HEADER, getHeader } from '#lib/api-key-auth.ts';
import { env } from '#lib/env.ts';
import { createKnowledgeMcpServer, type KnowledgePageReader } from '#lib/knowledge-mcp-server.ts';

type FetchHandler = (request: Request) => Promise<Response>;

// Internal callers authenticate with the static api-key header rather than a
// Google token. mcp-use's /mcp handler only understands Bearer, so a valid
// api-key is rewritten into an Authorization: Bearer header that verifyToken
// recognizes (it accepts the brain api-key as a bearer).
function withApiKeyBridge(handler: FetchHandler): FetchHandler {
  return (request) => {
    if (request.headers.has('authorization')) {
      return handler(request);
    }
    const apiKey = getHeader(request.headers, API_KEY_HEADER);
    if (apiKey !== env.brainApiKey) {
      return handler(request);
    }
    const headers = new Headers(request.headers);
    headers.set('authorization', `Bearer ${apiKey}`);
    return handler(new Request(request, { headers }));
  };
}

// `getHandler()` is async (it mounts the MCP, OAuth, and widget routes once),
// but Elysia's `.mount()` wants a sync handler. The handler is built lazily on
// the first request and memoized, so `createApp()` stays synchronous.
export function createMcpFetchHandler(pages: KnowledgePageReader): FetchHandler {
  let handlerPromise: Promise<FetchHandler> | null = null;
  const resolveHandler = (): Promise<FetchHandler> => {
    handlerPromise ??= createKnowledgeMcpServer(pages).getHandler().then(withApiKeyBridge);
    return handlerPromise;
  };
  return async (request) => (await resolveHandler())(request);
}
