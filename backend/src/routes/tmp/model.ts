import { t } from 'elysia';

// TEMP: debug endpoint to confirm Nango syncs reach the backend. Remove once done.
export const SyncPingBodySchema = t.Object({
  model: t.String(),
  count: t.Number(),
});

export const SyncPingResponseSchema = t.Object({
  received: t.Literal(true),
});
