import { Elysia } from 'elysia';

export const PUBLIC_CORS_MACRO_NAME = 'publicCors';

/**
 * Marks an endpoint as publicly readable by browser-based MCP clients (OAuth
 * discovery documents and Dynamic Client Registration): every response carries
 * a wildcard CORS origin.
 */
export const publicCors = new Elysia({ name: 'publicCors' }).macro(PUBLIC_CORS_MACRO_NAME, {
  beforeHandle({ set }) {
    set.headers['access-control-allow-origin'] = '*';
  },
});
