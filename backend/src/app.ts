import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { apiKeySecuritySchemes } from '#lib/auth/api-key.ts';
import { sessionSecuritySchemes } from '#lib/auth/better-auth.ts';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { requestResponsePlugin } from '#lib/request-response.ts';
import { apiController } from '#routes/api/controller.ts';
import { rootController } from '#routes/controller.ts';
import { internalController } from '#routes/internal/controller.ts';

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
            {
              name: 'Knowledge',
              description: 'Search and read knowledge distilled from records.',
            },
            {
              name: 'Knowledge Types',
              description: 'Manage the controlled vocabulary of knowledge types.',
            },
          ],
          components: {
            securitySchemes: {
              ...apiKeySecuritySchemes,
              ...sessionSecuritySchemes,
            },
          },
        },
      }),
    )
    .use(apiController)
    .use(internalController)
    .use(rootController);
}
