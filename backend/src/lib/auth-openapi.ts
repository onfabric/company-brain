import type { OpenAPIV3 } from 'openapi-types';
import { AUTH_BASE_PATH, auth } from '#lib/auth.ts';

const AUTH_TAG = 'Better Auth';

let schema: ReturnType<typeof auth.api.generateOpenAPISchema> | undefined;

function getSchema(): ReturnType<typeof auth.api.generateOpenAPISchema> {
  schema ??= auth.api.generateOpenAPISchema();
  return schema;
}

// Merges better-auth's generated OpenAPI document into Elysia's: every path is
// prefixed with the auth base path and tagged so the auth endpoints group
// together in the spec.
export async function betterAuthPaths(): Promise<OpenAPIV3.PathsObject> {
  const { paths } = await getSchema();
  const prefixed: OpenAPIV3.PathsObject = Object.create(null);
  for (const [path, item] of Object.entries(paths)) {
    for (const operation of Object.values(item as Record<string, OpenAPIV3.OperationObject>)) {
      operation.tags = [AUTH_TAG];
    }
    prefixed[`${AUTH_BASE_PATH}${path}`] = item as OpenAPIV3.PathItemObject;
  }
  return prefixed;
}

export async function betterAuthComponents(): Promise<OpenAPIV3.ComponentsObject> {
  const { components } = await getSchema();
  return components as OpenAPIV3.ComponentsObject;
}
