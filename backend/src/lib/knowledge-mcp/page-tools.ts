import type { MCPServer } from 'mcp-use/server';
import { z } from 'zod';
import { readPage } from '#lib/knowledge-mcp/respond.ts';
import type { KnowledgePageReader } from '#lib/knowledge-mcp/types.ts';

export function registerKnowledgePageTools(server: MCPServer<true>, pages: KnowledgePageReader) {
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
}
