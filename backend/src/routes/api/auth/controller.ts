import { Elysia } from 'elysia';
import { auth } from '#lib/auth.ts';

// Mounts better-auth's request handler under /api/auth/*: it serves the OAuth
// 2.1 authorization server (authorize, token, register/DCR), the OpenID and
// authorization-server discovery documents, JWKS, and the Google sign-in flow.
export const authController = new Elysia().mount('/api/auth', auth.handler);
