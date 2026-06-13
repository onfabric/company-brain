import type { OpenAPIV3 } from 'openapi-types';
import { env } from '#lib/env.ts';

export const API_KEY_HEADER = 'Api-Key';
export const API_KEY_SECURITY_SCHEME = 'apiKey';

export const apiKeySecuritySchemes = {
  [API_KEY_SECURITY_SCHEME]: {
    type: 'apiKey',
    in: 'header',
    name: API_KEY_HEADER,
    description: 'API Key',
  },
} satisfies Record<string, OpenAPIV3.SecuritySchemeObject>;

export type RequestHeaders = Headers | Record<string, string | undefined>;

export function hasValidApiKey(headers: RequestHeaders): boolean {
  return getHeader(headers, API_KEY_HEADER) === env.brainApiKey;
}

export function getHeader(headers: RequestHeaders, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}
