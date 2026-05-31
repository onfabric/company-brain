import { z } from 'zod';

// Circleback only exposes its data through an MCP server (provider `circleback-mcp`),
// reached via Nango's proxy at the `mcp` endpoint using the Streamable HTTP transport.
// This client speaks JSON-RPC 2.0 over POST: initialize, then notifications/initialized,
// then tools/call. Responses arrive either as a JSON body or as an SSE stream, and both
// shapes are handled here.

const MCP_ENDPOINT = 'mcp';
const PROTOCOL_VERSION = '2025-06-18';
const PROXY_RETRIES = 3;

const JsonRpcErrorSchema = z.object({
  code: z.number().optional(),
  message: z.string(),
});

const JsonRpcResponseSchema = z.object({
  jsonrpc: z.string().optional(),
  id: z.union([z.string(), z.number()]).nullable().optional(),
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional(),
});

const ToolResultSchema = z.object({
  content: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

export interface McpProxyClient {
  post(config: {
    endpoint: string;
    headers?: Record<string, string>;
    data?: unknown;
    retries?: number;
  }): Promise<{ data: unknown; status?: number; headers?: unknown }>;
}

export class CirclebackMcpClient {
  private sessionId: string | undefined;
  private nextId = 1;

  constructor(private readonly nango: McpProxyClient) {}

  async initialize(): Promise<void> {
    await this.send('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'company-brain', version: '1.0.0' },
    });

    await this.nango.post({
      endpoint: MCP_ENDPOINT,
      headers: this.headers(),
      data: { jsonrpc: '2.0', method: 'notifications/initialized' },
      retries: PROXY_RETRIES,
    });
  }

  async callTool<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const result = await this.send('tools/call', { name, arguments: args });
    const toolResult = ToolResultSchema.parse(result ?? {});
    const payload = extractToolPayload(toolResult);

    if (toolResult.isError) {
      const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
      throw new Error(`Circleback MCP tool "${name}" returned an error: ${detail}`);
    }

    return schema.parse(payload);
  }

  private async send(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const response = await this.nango.post({
      endpoint: MCP_ENDPOINT,
      headers: this.headers(),
      data: { jsonrpc: '2.0', id, method, params },
      retries: PROXY_RETRIES,
    });

    const sessionId = readSessionId(response.headers);
    if (sessionId) {
      this.sessionId = sessionId;
    }

    const message = parseJsonRpc(response.data, id);
    if (message.error) {
      throw new Error(`Circleback MCP "${method}" failed: ${message.error.message}`);
    }

    return message.result;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
    };

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    return headers;
  }
}

function readSessionId(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === 'mcp-session-id' && typeof value === 'string' && value) {
      return value;
    }
  }

  return undefined;
}

function parseJsonRpc(data: unknown, id: number): JsonRpcResponse {
  const messages = typeof data === 'string' ? parseStringBody(data) : [data];
  const candidates = messages
    .map((message) => JsonRpcResponseSchema.safeParse(message))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);

  const matched = candidates.find((message) => message.id === id);
  const enveloped = candidates.find(
    (message) => message.result !== undefined || message.error !== undefined,
  );

  return matched ?? enveloped ?? { result: data };
}

// The proxy returns the body as a string for both `application/json` and
// `text/event-stream` responses, so try a plain JSON parse first and fall back
// to SSE frame extraction.
function parseStringBody(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return [JSON.parse(trimmed)];
    } catch {
      // Not a plain JSON body; treat as SSE below.
    }
  }
  return parseSse(raw);
}

function parseSse(raw: string): unknown[] {
  const messages: unknown[] = [];

  for (const block of raw.split(/\r?\n\r?\n/)) {
    const dataPayload = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');

    if (!dataPayload) {
      continue;
    }

    try {
      messages.push(JSON.parse(dataPayload));
    } catch {
      // Ignore keep-alive comments and non-JSON SSE frames.
    }
  }

  return messages;
}

function extractToolPayload(result: z.infer<typeof ToolResultSchema>): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const text = (result.content ?? [])
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text)
    .join('\n')
    .trim();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
