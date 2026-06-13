import type { OpenAPIV3 } from 'openapi-types';
import { auth } from '#lib/auth/better-auth.ts';

export const SESSION_SECURITY_SCHEME = 'betterAuthSession';

export const sessionSecuritySchemes = {
  [SESSION_SECURITY_SCHEME]: {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
    description: 'better-auth session cookie set after signing in with Google',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

export async function hasValidSession(headers: Headers): Promise<boolean> {
  try {
    return (await auth.api.getSession({ headers })) !== null;
  } catch {
    return false;
  }
}
