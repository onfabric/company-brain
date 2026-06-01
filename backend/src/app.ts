import { Elysia } from 'elysia';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { healthController } from '#routes/health/controller.ts';

export function createApp() {
  return new Elysia().onError(elysiaErrorHandler).use(healthController);
}
