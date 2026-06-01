import { Elysia } from 'elysia';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { elysiaRequestHandler } from '#lib/requests.ts';
import { healthController } from '#routes/health/controller.ts';
import { batchSaveController } from '#routes/webhooks/batch-save/controller.ts';

export function createApp() {
  return new Elysia()
    .onError(elysiaErrorHandler)
    .onRequest(elysiaRequestHandler)
    .use(healthController)
    .use(batchSaveController);
}
