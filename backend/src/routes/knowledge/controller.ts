import { Elysia, StatusMap } from 'elysia';
import { apiKeyAuth, REQUIRE_API_KEY_MACRO_NAME } from '#lib/api-key-auth.ts';
import { KnowledgeQuerySchema, KnowledgeResponseSchema } from '#routes/knowledge/model.ts';
import { KnowledgeServicePlugin, loggerPlugin } from '#services/plugins.ts';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export const knowledgeController = new Elysia()
  .use(loggerPlugin('knowledgeController'))
  .use(KnowledgeServicePlugin)
  .use(apiKeyAuth)
  .get(
    '/knowledge',
    async ({ query, knowledgeService, logger, status }) => {
      logger.info(
        `searching knowledge: q=${query.q ?? ''} type=${query.knowledge_type_id ?? ''} people=${query.person_id?.length ?? 0} record=${query.record_id ?? ''} sort=${query.sort_by ?? ''}:${query.sort_order ?? ''}`,
      );
      const result = await knowledgeService.search({
        query: query.q,
        knowledgeTypeId: query.knowledge_type_id,
        personIds: query.person_id,
        recordId: query.record_id,
        sortBy: query.sort_by,
        sortOrder: query.sort_order,
        limit: query.limit ?? DEFAULT_LIMIT,
        offset: query.offset ?? DEFAULT_OFFSET,
      });
      return status(StatusMap.OK, result);
    },
    {
      [REQUIRE_API_KEY_MACRO_NAME]: true,
      detail: {
        tags: ['Knowledge'],
        summary: 'List and search knowledge',
        description:
          'Full-text search over distilled knowledge, with optional filtering via query parameters. Omit the query to list knowledge matching the filters. Results are paginated.',
      },
      query: KnowledgeQuerySchema,
      response: {
        [StatusMap.OK]: KnowledgeResponseSchema,
      },
    },
  );
