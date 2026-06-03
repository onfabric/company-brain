import { Elysia, StatusMap, t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import { env } from '#lib/env.ts';

export const API_KEY_HEADER = 'api-key';
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

export const apiKeyAuth = new Elysia({ name: 'apiKeyAuth' }).macro(REQUIRE_API_KEY_MACRO_NAME, {
  detail: { security: [{ [API_KEY_SECURITY_SCHEME]: [] }] },
  response: {
    [StatusMap.Unauthorized]: t.Object({ error: t.String() }),
  },
  beforeHandle({ headers, status }) {
    if (headers[API_KEY_HEADER] !== env.brainApiKey) {
      return status(StatusMap.Unauthorized, { error: 'Unauthorized' });
    }
  },
});
