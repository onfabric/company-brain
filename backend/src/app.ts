import { Elysia } from 'elysia';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { elysiaRequestHandler } from '#lib/requests.ts';
import { healthController } from '#routes/health/controller.ts';

export function createApp() {
  return new Elysia()
    .onError(elysiaErrorHandler)
    .onRequest(elysiaRequestHandler)
    .use(healthController);
}
