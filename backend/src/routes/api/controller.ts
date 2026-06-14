import { Elysia } from 'elysia';
import { dataSourcesController } from '#routes/api/data-sources/controller.ts';
import { healthController } from '#routes/api/health/controller.ts';
import { knowledgeIdController } from '#routes/api/knowledge/[id]/controller.ts';
import { knowledgeController } from '#routes/api/knowledge/controller.ts';
import { knowledgePagesIdController } from '#routes/api/knowledge/pages/[id]/controller.ts';
import { knowledgePagesIndexController } from '#routes/api/knowledge/pages/index/controller.ts';
import { knowledgeTypesIdController } from '#routes/api/knowledge-types/[id]/controller.ts';
import { knowledgeTypesController } from '#routes/api/knowledge-types/controller.ts';
import { peopleIdController } from '#routes/api/people/[id]/controller.ts';
import { peopleController } from '#routes/api/people/controller.ts';
import { peopleMergeController } from '#routes/api/people/merge/controller.ts';
import { recordsIdController } from '#routes/api/records/[id]/controller.ts';
import { recordsController } from '#routes/api/records/controller.ts';
import { batchSaveController } from '#routes/api/webhooks/batch-save/controller.ts';

// Every REST endpoint is served under `/api`; the prefix is applied here so the
// child controllers keep their bare path strings and the root origin is left to
// `rootController` (the MCP mount and the dashboard SPA).
export const apiController = new Elysia({ prefix: '/api' })
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
  .use(batchSaveController);
