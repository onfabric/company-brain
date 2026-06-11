import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createKnowledgeMcpServer, type KnowledgePageReader } from '#lib/knowledge-mcp-server.ts';
import { Service } from '#services/service.ts';

export class KnowledgeMcpService extends Service {
  private readonly pages: KnowledgePageReader;

  constructor(pages: KnowledgePageReader) {
    super();
    this.pages = pages;
  }

  // The SDK pairs each server instance with exactly one transport, so a shared
  // instance would cross-wire concurrent requests; stateless Streamable HTTP
  // expects a fresh pair per request, and building one only registers the tools.
  async handleRequest(request: Request, parsedBody: unknown): Promise<Response> {
    this.logger.info('handling MCP request');
    const server = createKnowledgeMcpServer(this.pages);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody });
    } finally {
      await server.close();
    }
  }
}
