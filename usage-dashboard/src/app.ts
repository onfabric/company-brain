import { Elysia } from 'elysia';

import { basicAuthHandler } from '#lib/auth.ts';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { elysiaRequestHandler } from '#lib/requests.ts';
import { usageController } from '#routes/api/usage/controller.ts';
import { dashboardController } from '#routes/dashboard/controller.ts';
import { healthController } from '#routes/health/controller.ts';

export function createApp() {
  return new Elysia()
    .onError(elysiaErrorHandler)
    .onRequest(elysiaRequestHandler)
    .onBeforeHandle(basicAuthHandler)
    .use(healthController)
    .use(usageController)
    .use(dashboardController);
}
