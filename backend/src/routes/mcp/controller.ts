import { Elysia } from 'elysia';
import { knowledgeMcpService } from '#services/plugins.ts';

// A single root mount exposes the combined mcp-use + better-auth Hono app: the
// `/mcp` transport and its OAuth 2.1 surface (bearer verification, the 401
// challenge, RFC 8414 / RFC 9728 discovery) plus better-auth's `/api/auth/*`.
// Static Elysia routes still win; the mount only catches paths Elysia lacks.
export const mcpController = new Elysia().mount((request) => knowledgeMcpService.fetch(request));
