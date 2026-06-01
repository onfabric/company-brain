import { Elysia } from 'elysia';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { healthController } from '#routes/health/controller.ts';
import { tmpController } from '#routes/tmp/controller.ts';

export function createApp() {
  return new Elysia().onError(elysiaErrorHandler).use(healthController).use(tmpController);
}
