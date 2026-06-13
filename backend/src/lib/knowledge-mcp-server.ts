import { MCPServer, oauthBetterAuthProvider, text } from 'mcp-use/server';
import { z } from 'zod';
import { AppError } from '#lib/errors.ts';
import { createLogger } from '#lib/logger.ts';

export type KnowledgePageReader = {
  getKnowledgeIndexHtmlPage(): Promise<string>;
  getKnowledgeHtmlPage(id: string): Promise<string>;
};

export type KnowledgeMcpServerConfig = {
  /** Public origin the MCP endpoint and discovery documents are reachable at. */
  baseUrl: string;
  /** better-auth base URL whose JWKS verifies bearer tokens and whose metadata is proxied. */
  issuer: string;
  /** Scopes advertised in the discovery documents. */
  scopes: string[];
  /** better-auth request handler, mounted on the same Hono app under its `/api/auth` basePath. */
  authHandler: (request: Request) => Promise<Response>;
};

const AUTH_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const;

const INSTRUCTIONS =
  'Read-only access to the company knowledge base, served as HTML pages. ' +
  'Call get_index_page first: the index links every page as /knowledge/pages/{id}. ' +
  'Follow a link by calling get_page with that {id}. Pages may link to further pages the same way.';

const logger = createLogger('knowledgeMcpServer');

// mcp-use owns the OAuth 2.1 surface for `/mcp`: bearer verification against the
// better-auth JWKS, the 401 `WWW-Authenticate` challenge, and the RFC 8414 /
// RFC 9728 discovery documents. better-auth shares the same Hono app so the
// brain exposes the whole authn/OAuth stack behind a single Elysia mount.
export function createKnowledgeMcpServer(
  pages: KnowledgePageReader,
  config: KnowledgeMcpServerConfig,
): MCPServer<true> {
  const server = new MCPServer({
    name: 'company-brain',
    version: '1.0.0',
    instructions: INSTRUCTIONS,
    baseUrl: config.baseUrl,
    oauth: oauthBetterAuthProvider({ authURL: config.issuer, scopesSupported: config.scopes }),
  });

  server.app.on([...AUTH_METHODS], '/api/auth/*', (c) => config.authHandler(c.req.raw));

  server.tool(
    {
      name: 'get_index_page',
      description:
        'Fetch the knowledge base index page as HTML. Start here: it links every available page ' +
        'as /knowledge/pages/{id}. Read a linked page with get_page.',
      annotations: { readOnlyHint: true },
    },
    () => readPage(() => pages.getKnowledgeIndexHtmlPage()),
  );

  server.tool(
    {
      name: 'get_page',
      description:
        'Fetch a single knowledge base page as HTML. Take the id from a /knowledge/pages/{id} ' +
        'link on the index page or on another page.',
      schema: z.object({
        id: z.uuid().describe('Page id from a /knowledge/pages/{id} link.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ id }) => readPage(() => pages.getKnowledgeHtmlPage(id)),
  );

  return server;
}

async function readPage(read: () => Promise<string>) {
  try {
    return text(await read());
  } catch (error) {
    if (error instanceof AppError) {
      return { content: [{ type: 'text' as const, text: error.message }], isError: true };
    }
    logger.error('failed to read knowledge page', error);
    return {
      content: [{ type: 'text' as const, text: 'Failed to read the knowledge page' }],
      isError: true,
    };
  }
}
