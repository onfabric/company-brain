import { auth, OAUTH_SCOPES } from '#lib/auth.ts';
import { env } from '#lib/env.ts';
import {
  createKnowledgeMcpServer,
  type KnowledgePageReader,
  type PeopleReader,
  type RecordsReader,
} from '#lib/knowledge-mcp-server.ts';
import { Service } from '#services/service.ts';

type FetchHandler = (request: Request) => Promise<Response>;

export class KnowledgeMcpService extends Service {
  private readonly handler: Promise<FetchHandler>;

  constructor(pages: KnowledgePageReader, records: RecordsReader, people: PeopleReader) {
    super();
    // `getHandler()` only mounts mcp-use's widget bundler / inspector (Vite, a
    // filesystem session store) when NODE_ENV !== 'production'. The brain ships
    // no widgets and always runs production (Dockerfile + the start/test scripts
    // set it), so this resolves to mcp-use's clean production path.
    const server = createKnowledgeMcpServer(pages, records, people, {
      baseUrl: env.publicUrl.origin,
      issuer: env.issuer,
      scopes: OAUTH_SCOPES,
      authHandler: (request) => auth.handler(request),
    });
    this.handler = server.getHandler();
  }

  /** Combined mcp-use + better-auth fetch handler, mounted once at the Elysia root. */
  fetch(request: Request): Promise<Response> {
    return this.handler.then((handle) => handle(request));
  }
}
