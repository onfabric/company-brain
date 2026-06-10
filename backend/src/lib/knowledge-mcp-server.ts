import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AppError } from '#lib/errors.ts';
import { createLogger } from '#lib/logger.ts';

export type KnowledgePageReader = {
  getKnowledgeIndexHtmlPage(): Promise<string>;
  getKnowledgeHtmlPage(id: string): Promise<string>;
};

const SERVER_INFO = {
  name: 'company-brain',
  title: 'Company Brain Knowledge Base',
  version: '1.0.0',
};

const INSTRUCTIONS =
  'Read-only access to the company knowledge base, served as HTML pages. ' +
  'Call get_index_page first: the index links every page as /knowledge/pages/{id}. ' +
  'Follow a link by calling get_page with that {id}. Pages may link to further pages the same way.';

const logger = createLogger('knowledgeMcpServer');

export function createKnowledgeMcpServer(pages: KnowledgePageReader): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });

  server.registerTool(
    'get_index_page',
    {
      title: 'Get the knowledge index page',
      description:
        'Fetch the knowledge base index page as HTML. Start here: it links every available page ' +
        'as /knowledge/pages/{id}. Read a linked page with get_page.',
      annotations: { readOnlyHint: true },
    },
    () => readPage(() => pages.getKnowledgeIndexHtmlPage()),
  );

  server.registerTool(
    'get_page',
    {
      title: 'Get a knowledge page',
      description:
        'Fetch a single knowledge base page as HTML. Take the id from a /knowledge/pages/{id} ' +
        'link on the index page or on another page.',
      inputSchema: {
        id: z.uuid().describe('Page id from a /knowledge/pages/{id} link.'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ id }) => readPage(() => pages.getKnowledgeHtmlPage(id)),
  );

  return server;
}

async function readPage(read: () => Promise<string>): Promise<CallToolResult> {
  try {
    return { content: [{ type: 'text', text: await read() }] };
  } catch (error) {
    if (error instanceof AppError) {
      return { content: [{ type: 'text', text: error.message }], isError: true };
    }
    logger.error('failed to read knowledge page', error);
    return {
      content: [{ type: 'text', text: 'Failed to read the knowledge page' }],
      isError: true,
    };
  }
}
