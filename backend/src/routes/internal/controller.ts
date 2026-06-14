import { Elysia } from 'elysia';
import { batchSaveController } from '#routes/internal/webhooks/batch-save/controller.ts';

// `/internal` is reachable only on the compose network: the Caddy edge does not
// forward `/internal/*`, so these endpoints are never exposed publicly.
export const internalController = new Elysia({ prefix: '/internal' }).use(batchSaveController);
