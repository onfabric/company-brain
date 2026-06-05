import { t } from 'elysia';
import {
  KNOWLEDGE_SORT_FIELDS,
  KNOWLEDGE_SORT_ORDERS,
} from '#repositories/knowledge.repository.ts';

const KnowledgeSortFieldSchema = t.Union(
  KNOWLEDGE_SORT_FIELDS.map((field) => t.Literal(field)),
  {
    description:
      'Field used to order knowledge. Defaults to relevance when q is present, otherwise created_at.',
  },
);

const KnowledgeSortOrderSchema = t.Union(
  KNOWLEDGE_SORT_ORDERS.map((order) => t.Literal(order)),
  {
    description: 'Direction used for the selected sort field.',
  },
);

export const KnowledgeQuerySchema = t.Object({
  q: t.Optional(
    t.String({
      minLength: 1,
      description: 'Full-text query over title and body. Omit to list matching the other filters.',
    }),
  ),
  knowledge_type_id: t.Optional(
    t.String({ format: 'uuid', description: 'Restrict results to a single knowledge type.' }),
  ),
  person_id: t.Optional(
    t.Array(t.String({ format: 'uuid' }), {
      minItems: 1,
      description: 'Restrict results to knowledge with any of these people as a participant.',
    }),
  ),
  record_id: t.Optional(
    t.String({
      format: 'uuid',
      description: 'Restrict results to knowledge distilled from this source record.',
    }),
  ),
  sort_by: t.Optional(KnowledgeSortFieldSchema),
  sort_order: t.Optional(KnowledgeSortOrderSchema),
  limit: t.Optional(
    t.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Maximum number of results to return.',
    }),
  ),
  offset: t.Optional(
    t.Integer({
      minimum: 0,
      default: 0,
      description: 'Number of results to skip, for pagination.',
    }),
  ),
});

export const KnowledgeTypeRefSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.String(),
});

export const KnowledgeParticipantSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.Union([t.String(), t.Null()]),
  email: t.Union([t.String(), t.Null()]),
  is_external: t.Boolean(),
  handle: t.Union([t.String(), t.Null()], {
    description:
      'A representative per-source identifier, for display when name and email are absent.',
  }),
});

export const KnowledgeSchema = t.Object({
  id: t.String(),
  created_at: t.String({
    format: 'date-time',
    description: 'Derived from the uuidv7 id; the moment the knowledge was distilled.',
  }),
  updated_at: t.String({
    format: 'date-time',
    description: 'Last time the knowledge was modified.',
  }),
  title: t.String(),
  body: t.String({ description: 'Full distilled content of the knowledge.' }),
  knowledge_type: KnowledgeTypeRefSchema,
  participants: t.Array(KnowledgeParticipantSchema),
  source_record_ids: t.Array(t.String({ format: 'uuid' }), {
    description: 'Ids of the records this knowledge was distilled from.',
  }),
});

export const KnowledgeHitSchema = t.Composite([
  KnowledgeSchema,
  t.Object({
    score: t.Union([t.Number(), t.Null()], {
      description: 'Relevance score for the full-text query; null when no query was given.',
    }),
    snippet: t.Union([t.String(), t.Null()], {
      description: 'Highlighted excerpt of the body match; null when no query was given.',
    }),
  }),
]);

export const KnowledgeResponseSchema = t.Object({
  total: t.Union([t.Integer(), t.Null()], {
    description:
      'Total number of knowledge matching the filters, ignoring pagination. Returned on the first page (offset 0); null on later pages to avoid recounting while scrolling.',
  }),
  limit: t.Integer(),
  offset: t.Integer(),
  results: t.Array(KnowledgeHitSchema),
});
