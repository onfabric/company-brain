import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { requestResponsePlugin } from '#lib/request-response.ts';
import { healthController } from '#routes/health/controller.ts';
import { peopleController } from '#routes/people/controller.ts';
import { peopleMergeController } from '#routes/people/merge/controller.ts';
import { recordsSearchController } from '#routes/records/search/controller.ts';
import { recordsSourcesController } from '#routes/records/sources/controller.ts';
import { batchSaveController } from '#routes/webhooks/batch-save/controller.ts';

export function createApp() {
  return new Elysia()
    .onError(elysiaErrorHandler)
    .use(requestResponsePlugin)
    .use(
      openapi({
        documentation: {
          info: {
            title: 'Company Brain API',
            version: '1.0.0',
          },
        },
      }),
    )
    .use(healthController)
    .use(peopleController)
    .use(peopleMergeController)
    .use(recordsSourcesController)
    .use(recordsSearchController)
    .use(batchSaveController);
}
