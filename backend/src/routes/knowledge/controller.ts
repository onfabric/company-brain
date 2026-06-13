import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth/plugin.ts';
import {
  CreateKnowledgeBodySchema,
  KnowledgeQuerySchema,
  KnowledgeResponseSchema,
  KnowledgeSchema,
} from '#routes/knowledge/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export const knowledgeController = new Elysia()
  .use(loggerPlugin('knowledgeController'))
  .use(KnowledgeServicePlugin)
  .use(authPlugin)
  .get(
    '/knowledge',
    async ({ query, knowledgeService, logger, status }) => {
      logger.info(
        `searching knowledge: q=${query.q ?? ''} type=${query.knowledge_type_id ?? ''} people=${query.person_id?.length ?? 0} record=${query.record_id ?? ''} sort=${query.sort_by ?? ''}:${query.sort_order ?? ''} view=${query.view ?? ''}`,
      );
      const result = await knowledgeService.search({
        query: query.q,
        knowledgeTypeId: query.knowledge_type_id,
        personIds: query.person_id,
        recordId: query.record_id,
        sortBy: query.sort_by,
        sortOrder: query.sort_order,
        view: query.view,
        limit: query.limit ?? DEFAULT_LIMIT,
        offset: query.offset ?? DEFAULT_OFFSET,
      });
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['Knowledge'],
        summary: 'List and search knowledge',
        description:
          'Full-text search over distilled knowledge, with optional filtering via query parameters. Omit the query to list knowledge matching the filters. Results are paginated. Results default to preview objects containing only id and title; use view=full to return complete knowledge items.',
      },
      query: KnowledgeQuerySchema,
      response: {
        [StatusMap.OK]: KnowledgeResponseSchema,
      },
    },
  )
  .post(
    '/knowledge',
    async ({ body, knowledgeService, logger, status }) => {
      logger.info(
        `creating knowledge: type=${body.knowledge_type_id} people=${body.person_ids?.length ?? 0} records=${body.record_ids?.length ?? 0}`,
      );
      const created = await knowledgeService.create({
        title: body.title,
        body: body.body,
        knowledge_type_id: body.knowledge_type_id,
        person_ids: body.person_ids ?? [],
        record_ids: body.record_ids ?? [],
      });
      return status(StatusMap.Created, created);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      parse: 'json',
      detail: {
        tags: ['Knowledge'],
        summary: 'Create knowledge',
        description:
          'Creates a distilled knowledge item, linking it to a knowledge type, participants, and the source records it was distilled from. Unknown referenced ids are rejected with 400.',
      },
      body: CreateKnowledgeBodySchema,
      response: {
        [StatusMap.Created]: KnowledgeSchema,
      },
    },
  );
