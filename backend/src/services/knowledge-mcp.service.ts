import { auth, OAUTH_SCOPES } from '#lib/auth.ts';
import { env } from '#lib/env.ts';
import { createKnowledgeMcpServer, type KnowledgePageReader } from '#lib/knowledge-mcp-server.ts';
import { Service } from '#services/service.ts';

type FetchHandler = (request: Request) => Promise<Response>;

// mcp-use's `getHandler()` runs its widget bundler, whose dev path resolves Vite
// and writes a `resources/` directory. The brain ships no widgets, so the handler
// is prepared in mcp-use's production widget mode — a clean no-op without a build
// manifest — which also selects in-memory session state.
async function prepareHandler(server: ReturnType<typeof createKnowledgeMcpServer>) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    return await server.getHandler();
  } finally {
    process.env.NODE_ENV = previous;
  }
}

export class KnowledgeMcpService extends Service {
  private readonly handler: Promise<FetchHandler>;

  constructor(pages: KnowledgePageReader) {
    super();
    this.handler = prepareHandler(
      createKnowledgeMcpServer(pages, {
        baseUrl: env.publicUrl.origin,
        issuer: env.issuer,
        scopes: OAUTH_SCOPES,
        authHandler: (request) => auth.handler(request),
      }),
    );
  }

  /** Combined mcp-use + better-auth fetch handler, mounted once at the Elysia root. */
  fetch(request: Request): Promise<Response> {
    return this.handler.then((handle) => handle(request));
  }
}
