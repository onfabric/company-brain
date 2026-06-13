import { MCPServer, oauthBetterAuthProvider } from 'mcp-use/server';
import { registerKnowledgeTools } from '#lib/knowledge-mcp/knowledge-tools.ts';
import { registerKnowledgeTypeTools } from '#lib/knowledge-mcp/knowledge-type-tools.ts';
import { registerKnowledgePageTools } from '#lib/knowledge-mcp/page-tools.ts';
import { registerRecordTools } from '#lib/knowledge-mcp/record-tools.ts';
import type { KnowledgeMcpServices } from '#lib/knowledge-mcp/types.ts';

export type {
  KnowledgeMcpServices,
  KnowledgePageReader,
  KnowledgeReader,
  KnowledgeTypesReader,
  PeopleReader,
  RecordsReader,
} from '#lib/knowledge-mcp/types.ts';

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
  'Access to the company knowledge base, distilled knowledge entries, knowledge types, and source records. ' +
  'Call get_index_page first for navigable HTML pages, or search_knowledge for structured JSON entries. ' +
  'Use get_knowledge_types, get_people, get_data_sources, and get_records to discover ids and filters before writing. ' +
  'Knowledge write tools use ids for knowledge_type_id, person_ids, and record_ids. Pages and paginated results contain at most 50 items.';

export function createKnowledgeMcpServer(
  services: KnowledgeMcpServices,
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

  registerKnowledgePageTools(server, services.knowledge);
  registerRecordTools(server, services.records, services.people);
  registerKnowledgeTools(server, services.knowledge);
  registerKnowledgeTypeTools(server, services.knowledgeTypes);

  return server;
}
