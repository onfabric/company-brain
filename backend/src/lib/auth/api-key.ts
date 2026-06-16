import type { OpenAPIV3 } from 'openapi-types';

export const API_KEY_HEADER = 'Api-Key';
export const API_KEY_SECURITY_SCHEME = 'apiKey';

// Leading characters kept on the row for display, so a key can be recognised in
// listings without exposing the secret (the full key is shown only at creation).
const DISPLAY_PREFIX_LENGTH = 8;

export const apiKeySecuritySchemes = {
  [API_KEY_SECURITY_SCHEME]: {
    type: 'apiKey',
    in: 'header',
    name: API_KEY_HEADER,
    description: 'API Key',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

export type RequestHeaders = Headers | Record<string, string | undefined>;

export function generateApiKey(): string {
  return crypto.randomUUID();
}

export function hashApiKey(key: string): string {
  return new Bun.CryptoHasher('sha256').update(key).digest('hex');
}

export function apiKeyDisplayPrefix(key: string): string {
  return key.slice(0, DISPLAY_PREFIX_LENGTH);
}

export function getHeader(headers: RequestHeaders, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}
