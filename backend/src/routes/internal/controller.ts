import { Elysia } from 'elysia';
import { batchSaveController } from '#routes/internal/webhooks/batch-save/controller.ts';

// Endpoints served under `/internal` are reachable only on the compose network
// (e.g. the Nango sink calling the brain by service name); the Caddy edge does
// not forward `/internal/*`, so they are never exposed publicly.
export const internalController = new Elysia({ prefix: '/internal' }).use(batchSaveController);
