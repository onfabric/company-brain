import { MCPServer, text } from 'mcp-use/server';
import { z } from 'zod';
import { AppError } from '#lib/errors.ts';
import { createLogger } from '#lib/logger.ts';

export type KnowledgePageReader = {
  getKnowledgeIndexHtmlPage(): Promise<string>;
  getKnowledgeHtmlPage(id: string): Promise<string>;
};

const INSTRUCTIONS =
  'Read-only access to the company knowledge base, served as HTML pages. ' +
  'Call get_index_page first: the index links every page as /knowledge/pages/{id}. ' +
  'Follow a link by calling get_page with that {id}. Pages may link to further pages the same way.';

const logger = createLogger('knowledgeMcpServer');

// Auth is fronted by the brain's own Elysia macro (a brain API key or a
// better-auth bearer token), so the mcp-use server is built without its OAuth
// provider: that provider's middleware only reads `Authorization` and cannot
// see the brain's `Api-Key` header, which would lock out machine clients.
export function createKnowledgeMcpServer(pages: KnowledgePageReader, baseUrl: string): MCPServer {
  const server = new MCPServer({
    name: 'company-brain',
    version: '1.0.0',
    instructions: INSTRUCTIONS,
    baseUrl,
  });

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
