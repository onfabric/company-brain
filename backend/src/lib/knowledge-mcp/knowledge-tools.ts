import type { MCPServer } from 'mcp-use/server';
import { z } from 'zod';
import { BadRequestError } from '#lib/errors.ts';
import { readJson } from '#lib/knowledge-mcp/respond.ts';
import type { KnowledgeReader } from '#lib/knowledge-mcp/types.ts';
import {
  KNOWLEDGE_RESULT_VIEWS,
  KNOWLEDGE_SORT_FIELDS,
  KNOWLEDGE_SORT_ORDERS,
} from '#repositories/knowledge.repository.ts';

const DEFAULT_KNOWLEDGE_LIMIT = 20;
const DEFAULT_KNOWLEDGE_OFFSET = 0;
const MAX_KNOWLEDGE_LIMIT = 50;

const CreateKnowledgeSchema = z.object({
  title: z.string().min(1).describe('Short title of the knowledge.'),
  body: z
    .string()
    .min(1)
    .describe('Sanitized HTML fragment containing the full distilled content of the knowledge.'),
  knowledge_type_id: z.uuid().describe('Knowledge type id from get_knowledge_types.'),
  person_ids: z
    .array(z.uuid())
    .optional()
    .describe('Participant person ids from get_people. Defaults to none.'),
  record_ids: z
    .array(z.uuid())
    .optional()
    .describe('Source record ids from get_records. Defaults to none.'),
});

const UpdateKnowledgeSchema = z
  .object({
    id: z.uuid().describe('Knowledge item id.'),
    title: z.string().min(1).optional().describe('Short title of the knowledge.'),
    body: z
      .string()
      .min(1)
      .optional()
      .describe('Sanitized HTML fragment containing the full distilled content of the knowledge.'),
    knowledge_type_id: z.uuid().optional().describe('Knowledge type id from get_knowledge_types.'),
    person_ids: z
      .array(z.uuid())
      .optional()
      .describe('Replaces the full participant set when present.'),
    record_ids: z
      .array(z.uuid())
      .optional()
      .describe('Replaces the full source-record set when present.'),
  })
  .refine(
    ({ id: _id, ...updates }) => Object.values(updates).some((value) => value !== undefined),
    { message: 'At least one update field must be provided.' },
  );

export function registerKnowledgeTools(server: MCPServer<true>, knowledge: KnowledgeReader) {
  server.tool(
    {
      name: 'search_knowledge',
      description:
        'Search or list distilled knowledge as paginated JSON. Mirrors the knowledge API with ' +
        'optional filters for type id, participant ids, source record id, result view, and sorting. ' +
        'Use limit and offset for pagination; limit cannot exceed 50.',
      schema: z.object({
        q: z.string().min(1).optional().describe('Optional full-text query over title and body.'),
        knowledge_type_id: z
          .uuid()
          .optional()
          .describe('Restrict results to a single knowledge type id.'),
        person_ids: z
          .array(z.uuid())
          .min(1)
          .optional()
          .describe('Restrict results to knowledge linked to any of these people.'),
        record_id: z
          .uuid()
          .optional()
          .describe('Restrict results to knowledge distilled from this source record.'),
        sort_by: z
          .enum(KNOWLEDGE_SORT_FIELDS)
          .optional()
          .describe('Field used to order knowledge.'),
        sort_order: z
          .enum(KNOWLEDGE_SORT_ORDERS)
          .optional()
          .describe('Direction used for the selected sort field.'),
        view: z
          .enum(KNOWLEDGE_RESULT_VIEWS)
          .optional()
          .describe('preview returns id and title; full returns complete knowledge items.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_KNOWLEDGE_LIMIT)
          .optional()
          .describe('Maximum number of knowledge items to return. Must be between 1 and 50.'),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Number of knowledge items to skip for pagination.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ q, knowledge_type_id, person_ids, record_id, sort_by, sort_order, view, limit, offset }) =>
      readJson(() =>
        knowledge.search({
          query: q,
          knowledgeTypeId: knowledge_type_id,
          personIds: person_ids,
          recordId: record_id,
          sortBy: sort_by,
          sortOrder: sort_order,
          view,
          limit: limit ?? DEFAULT_KNOWLEDGE_LIMIT,
          offset: offset ?? DEFAULT_KNOWLEDGE_OFFSET,
        }),
      ),
  );

  server.tool(
    {
      name: 'get_knowledge',
      description: 'Fetch a single distilled knowledge item by id as JSON.',
      schema: z.object({
        id: z.uuid().describe('Knowledge item id.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ id }) => readJson(() => knowledge.getKnowledge(id)),
  );

  server.tool(
    {
      name: 'create_knowledge',
      description:
        'Create a distilled knowledge item. Body is sanitized HTML. Use ids from get_knowledge_types, ' +
        'get_people, and get_records for references.',
      schema: CreateKnowledgeSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ title, body, knowledge_type_id, person_ids, record_ids }) =>
      readJson(() =>
        knowledge.create({
          title,
          body,
          knowledge_type_id,
          person_ids: person_ids ?? [],
          record_ids: record_ids ?? [],
        }),
      ),
  );

  server.tool(
    {
      name: 'update_knowledge',
      description:
        'Update a distilled knowledge item. Only included fields are changed. person_ids and ' +
        'record_ids replace their full sets when present.',
      schema: UpdateKnowledgeSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ id, title, body, knowledge_type_id, person_ids, record_ids }) =>
      readJson(() => {
        if (
          title === undefined &&
          body === undefined &&
          knowledge_type_id === undefined &&
          person_ids === undefined &&
          record_ids === undefined
        ) {
          throw new BadRequestError('At least one update field must be provided.');
        }
        return knowledge.update(id, {
          title,
          body,
          knowledge_type_id,
          person_ids,
          record_ids,
        });
      }),
  );

  server.tool(
    {
      name: 'delete_knowledge',
      description:
        'Delete a distilled knowledge item by id, including its participant and source-record links.',
      schema: z.object({
        id: z.uuid().describe('Knowledge item id.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    ({ id }) => readJson(async () => ({ id: await knowledge.remove(id) })),
  );
}
