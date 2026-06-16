import type { MCPServer } from 'mcp-use/server';
import { z } from 'zod';
import { BadRequestError } from '#lib/errors.ts';
import { requirePersonIds, resolvePersonIds } from '#lib/knowledge-mcp/people-resolution.ts';
import { readJson } from '#lib/knowledge-mcp/respond.ts';
import type {
  KnowledgeReader,
  KnowledgeTypesReader,
  PeopleReader,
} from '#lib/knowledge-mcp/types.ts';
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
  knowledge_type: z
    .string()
    .trim()
    .min(1)
    .describe('Exact knowledge type name from get_knowledge_types.'),
  people: z
    .array(z.string().trim().min(1))
    .optional()
    .describe('Exact participant names or emails from get_people. Defaults to none.'),
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
    knowledge_type: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Exact knowledge type name from get_knowledge_types.'),
    people: z
      .array(z.string().trim().min(1))
      .optional()
      .describe('Replaces the full participant set with people matched by exact name or email.'),
    record_ids: z
      .array(z.uuid())
      .optional()
      .describe('Replaces the full source-record set when present.'),
  })
  .refine(
    ({ id: _id, ...updates }) => Object.values(updates).some((value) => value !== undefined),
    { message: 'At least one update field must be provided.' },
  );

export function registerKnowledgeTools(
  server: MCPServer<true>,
  knowledge: KnowledgeReader,
  people: PeopleReader,
  knowledgeTypes: KnowledgeTypesReader,
) {
  server.tool(
    {
      name: 'search_knowledge',
      description:
        'Search or list distilled knowledge as paginated JSON. Mirrors the knowledge API with ' +
        'optional filters for exact type name, exact participant names or emails, result view, and sorting. ' +
        'Use limit and offset for pagination; limit cannot exceed 50.',
      schema: z.object({
        q: z.string().min(1).optional().describe('Optional full-text query over title and body.'),
        knowledge_type: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            'Restrict results to a single exact knowledge type name from get_knowledge_types.',
          ),
        people: z
          .array(z.string().trim().min(1))
          .min(1)
          .optional()
          .describe('Restrict results to people whose name or email exactly matches any value.'),
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
    ({
      q,
      knowledge_type,
      people: personNamesOrEmails,
      sort_by,
      sort_order,
      view,
      limit,
      offset,
    }) =>
      readJson(async () => {
        const page = {
          limit: limit ?? DEFAULT_KNOWLEDGE_LIMIT,
          offset: offset ?? DEFAULT_KNOWLEDGE_OFFSET,
        };
        const knowledgeTypeId = await resolveKnowledgeTypeId(knowledgeTypes, knowledge_type);
        const personIds = await resolvePersonIds(people, personNamesOrEmails);
        if (knowledgeTypeId === null || personIds?.length === 0) {
          return emptyKnowledgePage(page.limit, page.offset);
        }
        return knowledge.search({
          query: q,
          knowledgeTypeId,
          personIds,
          sortBy: sort_by,
          sortOrder: sort_order,
          view,
          ...page,
        });
      }),
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
        'Create a distilled knowledge item only after following the relevant get_knowledge_workflow instructions and receiving explicit draft approval. Body is sanitized HTML. Use exact names from ' +
        'get_knowledge_types and get_people, plus record ids from get_records, for references.',
      schema: CreateKnowledgeSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ title, body, knowledge_type, people: personNamesOrEmails, record_ids }) =>
      readJson(async () =>
        knowledge.create({
          title,
          body,
          knowledge_type_id: await requireKnowledgeTypeId(knowledgeTypes, knowledge_type),
          person_ids: await requirePersonIds(people, personNamesOrEmails),
          record_ids: record_ids ?? [],
        }),
      ),
  );

  server.tool(
    {
      name: 'update_knowledge',
      description:
        'Update a distilled knowledge item only after following the relevant get_knowledge_workflow instructions and receiving explicit draft approval. Only included fields are changed. people and ' +
        'record_ids replace their full sets when present.',
      schema: UpdateKnowledgeSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ id, title, body, knowledge_type, people: personNamesOrEmails, record_ids }) =>
      readJson(async () => {
        if (
          title === undefined &&
          body === undefined &&
          knowledge_type === undefined &&
          personNamesOrEmails === undefined &&
          record_ids === undefined
        ) {
          throw new BadRequestError('At least one update field must be provided.');
        }
        return knowledge.update(id, {
          title,
          body,
          knowledge_type_id:
            knowledge_type === undefined
              ? undefined
              : await requireKnowledgeTypeId(knowledgeTypes, knowledge_type),
          person_ids:
            personNamesOrEmails === undefined
              ? undefined
              : await requirePersonIds(people, personNamesOrEmails),
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

async function resolveKnowledgeTypeId(
  knowledgeTypes: KnowledgeTypesReader,
  knowledgeTypeName: string | undefined,
): Promise<string | null | undefined> {
  if (knowledgeTypeName === undefined) {
    return undefined;
  }
  const types = await knowledgeTypes.list();
  return types.find((type) => type.name === knowledgeTypeName)?.id ?? null;
}

async function requireKnowledgeTypeId(
  knowledgeTypes: KnowledgeTypesReader,
  knowledgeTypeName: string,
): Promise<string> {
  const id = await resolveKnowledgeTypeId(knowledgeTypes, knowledgeTypeName);
  if (!id) {
    throw new BadRequestError(`unknown knowledge_type: ${knowledgeTypeName}`);
  }
  return id;
}

function emptyKnowledgePage(limit: number, offset: number) {
  return { total: offset === 0 ? 0 : null, limit, offset, results: [] };
}
