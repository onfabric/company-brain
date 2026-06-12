import { Elysia, StatusMap, t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import { env } from '#lib/env.ts';

export const API_KEY_HEADER = 'Api-Key';
export const API_KEY_SECURITY_SCHEME = 'apiKey';
export const REQUIRE_API_KEY_MACRO_NAME = 'requireApiKey';

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

export const apiKeyAuth = new Elysia({ name: 'apiKeyAuth' }).macro(REQUIRE_API_KEY_MACRO_NAME, {
  detail: { security: [{ [API_KEY_SECURITY_SCHEME]: [] }] },
  response: {
    [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
  },
  beforeHandle({ headers, status }) {
    if (!hasValidApiKey(headers)) {
      return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
    }
  },
});

function getHeader(headers: RequestHeaders, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}
