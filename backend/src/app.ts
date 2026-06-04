import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { apiKeySecuritySchemes } from '#lib/api-key-auth.ts';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { requestResponsePlugin } from '#lib/request-response.ts';
import { dataSourcesController } from '#routes/data-sources/controller.ts';
import { healthController } from '#routes/health/controller.ts';
import { peopleController } from '#routes/people/controller.ts';
import { peopleMergeController } from '#routes/people/merge/controller.ts';
import { recordsController } from '#routes/records/controller.ts';
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
          tags: [
            {
              name: 'People',
              description: 'List, update, and merge the people derived from ingested records.',
            },
            {
              name: 'Records',
              description: 'Search ingested records.',
            },
            {
              name: 'Data Sources',
              description: 'Inspect the data sources that have ingested records.',
            },
          ],
          components: {
            securitySchemes: apiKeySecuritySchemes,
          },
        },
      }),
    )
    .use(healthController)
    .use(peopleController)
    .use(peopleMergeController)
    .use(dataSourcesController)
    .use(recordsController)
    .use(batchSaveController);
}
