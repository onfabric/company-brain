import { MCPServer, oauthProxy } from 'mcp-use/server';
import { z } from 'zod';
import { env } from '#lib/env.ts';
import { AppError } from '#lib/errors.ts';
import { GOOGLE_AUTHORIZATION_ENDPOINT, GOOGLE_SCOPES_SUPPORTED } from '#lib/google-oauth.ts';
import { verifyGoogleAccessToken } from '#lib/google-token-verifier.ts';
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

type PageContent = { content: { type: 'text'; text: string }[]; isError?: boolean };

const logger = createLogger('knowledgeMcpServer');

// mcp-use's OAuth proxy: clients log in directly with Google (hd restricts to
// the workspace) while the brain — Google's single pre-registered client —
// serves the AS metadata, /register (cosmetic DCR), and /token (injecting the
// client secret). verifyToken validates Google's opaque access token per
// request. tokenEndpoint targets env so tests can point it at a local mock.
export function createKnowledgeMcpServer(pages: KnowledgePageReader): MCPServer {
  const server = new MCPServer({
    ...SERVER_INFO,
    instructions: INSTRUCTIONS,
    stateless: true,
    oauth: oauthProxy({
      authEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
      tokenEndpoint: env.googleTokenEndpoint,
      issuer: env.brainPublicUrl.origin,
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      scopes: [...GOOGLE_SCOPES_SUPPORTED],
      extraAuthorizeParams: { hd: env.googleWorkspaceDomain, access_type: 'offline' },
      verifyToken: verifyGoogleAccessToken,
    }),
  });

  server.tool(
    {
      name: 'get_index_page',
      title: 'Get the knowledge index page',
      description:
        'Fetch the knowledge base index page as HTML. Start here: it links every available page ' +
        'as /knowledge/pages/{id}. Read a linked page with get_page.',
      schema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    () => readPage(() => pages.getKnowledgeIndexHtmlPage()),
  );

  server.tool(
    {
      name: 'get_page',
      title: 'Get a knowledge page',
      description:
        'Fetch a single knowledge base page as HTML. Take the id from a /knowledge/pages/{id} ' +
        'link on the index page or on another page.',
      schema: z.object({
        id: z.string().uuid().describe('Page id from a /knowledge/pages/{id} link.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ id }) => readPage(() => pages.getKnowledgeHtmlPage(id)),
  );

  return server;
}

async function readPage(read: () => Promise<string>): Promise<PageContent> {
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
