import { t } from 'elysia';

export const ProtectedResourceMetadataSchema = t.Object({
  resource: t.String(),
  authorization_servers: t.Array(t.String()),
  scopes_supported: t.Array(t.String()),
  bearer_methods_supported: t.Array(t.String()),
});
