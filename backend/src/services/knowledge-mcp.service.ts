import { handleAuthRequest, OAUTH_SCOPES } from '#lib/auth/better-auth.ts';
import { env } from '#lib/env.ts';
import { createKnowledgeMcpServer, type KnowledgeMcpServices } from '#lib/knowledge-mcp-server.ts';
import { Service } from '#services/service.ts';

type FetchHandler = (request: Request) => Promise<Response>;

export class KnowledgeMcpService extends Service {
  private readonly handler: Promise<FetchHandler>;

  constructor(services: KnowledgeMcpServices) {
    super();
    // `getHandler()` only mounts mcp-use's widget bundler / inspector (Vite, a
    // filesystem session store) when NODE_ENV !== 'production'. The brain ships
    // no widgets and always runs production (Dockerfile + the start/test scripts
    // set it), so this resolves to mcp-use's clean production path.
    const server = createKnowledgeMcpServer(services, {
      baseUrl: env.publicUrl.origin,
      issuer: env.issuer,
      scopes: OAUTH_SCOPES,
      authHandler: handleAuthRequest,
    });
    this.handler = server.getHandler();
  }

  /** Combined mcp-use + better-auth fetch handler, mounted once at the Elysia root. */
  fetch(request: Request): Promise<Response> {
    return this.handler.then((handle) => handle(request));
  }
}
