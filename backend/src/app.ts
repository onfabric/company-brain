import { Elysia } from 'elysia';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { elysiaRequestHandler } from '#lib/requests.ts';
import { healthController } from '#routes/health/controller.ts';
import { peopleController } from '#routes/people/controller.ts';
import { recordsSearchController } from '#routes/records/search/controller.ts';
import { recordsSourcesController } from '#routes/records/sources/controller.ts';
import { batchSaveController } from '#routes/webhooks/batch-save/controller.ts';

export function createApp() {
  return new Elysia()
    .onError(elysiaErrorHandler)
    .onRequest(elysiaRequestHandler)
    .use(healthController)
    .use(peopleController)
    .use(recordsSourcesController)
    .use(recordsSearchController)
    .use(batchSaveController);
}
