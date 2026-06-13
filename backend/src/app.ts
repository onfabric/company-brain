import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { apiKeySecuritySchemes } from '#lib/auth/api-key.ts';
import { sessionSecuritySchemes } from '#lib/auth/better-auth.ts';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { requestResponsePlugin } from '#lib/request-response.ts';
import { consentController } from '#routes/consent/controller.ts';
import { dashboardController } from '#routes/dashboard/controller.ts';
import { dataSourcesController } from '#routes/data-sources/controller.ts';
import { healthController } from '#routes/health/controller.ts';
import { knowledgeIdController } from '#routes/knowledge/[id]/controller.ts';
import { knowledgeController } from '#routes/knowledge/controller.ts';
import { knowledgePagesIdController } from '#routes/knowledge/pages/[id]/controller.ts';
import { knowledgePagesIndexController } from '#routes/knowledge/pages/index/controller.ts';
import { knowledgeTypesIdController } from '#routes/knowledge-types/[id]/controller.ts';
import { knowledgeTypesController } from '#routes/knowledge-types/controller.ts';
import { mcpController } from '#routes/mcp/controller.ts';
import { peopleIdController } from '#routes/people/[id]/controller.ts';
import { peopleController } from '#routes/people/controller.ts';
import { peopleMergeController } from '#routes/people/merge/controller.ts';
import { recordsIdController } from '#routes/records/[id]/controller.ts';
import { recordsController } from '#routes/records/controller.ts';
import { signInController } from '#routes/sign-in/controller.ts';
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
    .use(signInController)
    .use(consentController)
    .use(dashboardController)
    .use(healthController)
    .use(peopleController)
    .use(peopleIdController)
    .use(peopleMergeController)
    .use(dataSourcesController)
    .use(knowledgeController)
    .use(knowledgeIdController)
    .use(knowledgePagesIndexController)
    .use(knowledgePagesIdController)
    .use(knowledgeTypesController)
    .use(knowledgeTypesIdController)
    .use(recordsController)
    .use(recordsIdController)
    .use(mcpController)
    .use(batchSaveController);
}
