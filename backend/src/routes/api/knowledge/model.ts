import { t } from 'elysia';
import { literalUnion } from '#lib/typebox.ts';
import {
  DEFAULT_KNOWLEDGE_RESULT_VIEW,
  KNOWLEDGE_RESULT_VIEWS,
  KNOWLEDGE_SORT_FIELDS,
  KNOWLEDGE_SORT_ORDERS,
} from '#repositories/knowledge.repository.ts';

const KnowledgeSortFieldSchema = literalUnion(KNOWLEDGE_SORT_FIELDS, {
  description:
    'Field used to order knowledge. Defaults to relevance when q is present, otherwise created_at.',
});

const KnowledgeSortOrderSchema = literalUnion(KNOWLEDGE_SORT_ORDERS, {
  description: 'Direction used for the selected sort field.',
});

const KnowledgeResultViewSchema = literalUnion(KNOWLEDGE_RESULT_VIEWS, {
  default: DEFAULT_KNOWLEDGE_RESULT_VIEW,
  description:
    'Response shape for results. preview returns only id and title; full returns complete knowledge items with search metadata.',
});

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
  view: t.Optional(KnowledgeResultViewSchema),
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

export const CreateKnowledgeBodySchema = t.Object({
  title: t.String({ minLength: 1, description: 'Short title of the knowledge.' }),
  body: t.String({
    minLength: 1,
    description: 'Sanitized HTML fragment containing the full distilled content of the knowledge.',
  }),
  knowledge_type_id: t.String({ format: 'uuid' }),
  person_ids: t.Optional(
    t.Array(t.String({ format: 'uuid' }), {
      default: [],
      description: 'Participants of this knowledge.',
    }),
  ),
  record_ids: t.Optional(
    t.Array(t.String({ format: 'uuid' }), {
      default: [],
      description: 'Source records this knowledge was distilled from.',
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

const KnowledgeIdSchema = t.String();
const KnowledgeTitleSchema = t.String();

export const KnowledgePreviewSchema = t.Object({
  id: KnowledgeIdSchema,
  title: KnowledgeTitleSchema,
});

export const KnowledgeSchema = t.Object({
  id: KnowledgeIdSchema,
  created_at: t.String({
    format: 'date-time',
    description: 'Derived from the uuidv7 id; the moment the knowledge was distilled.',
  }),
  updated_at: t.String({
    format: 'date-time',
    description: 'Last time the knowledge was modified.',
  }),
  title: KnowledgeTitleSchema,
  body: t.String({
    description: 'Sanitized HTML fragment containing the full distilled content of the knowledge.',
  }),
  html_url: t.String({
    description: 'Browser-navigable HTML representation of this knowledge item.',
  }),
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

const KnowledgePageFields = {
  total: t.Union([t.Integer(), t.Null()], {
    description:
      'Total number of knowledge matching the filters, ignoring pagination. Returned on the first page (offset 0); null on later pages to avoid recounting while scrolling.',
  }),
  limit: t.Integer(),
  offset: t.Integer(),
};

export const KnowledgePreviewResponseSchema = t.Object({
  ...KnowledgePageFields,
  results: t.Array(KnowledgePreviewSchema),
});

export const KnowledgeFullResponseSchema = t.Object({
  ...KnowledgePageFields,
  results: t.Array(KnowledgeHitSchema),
});

export const KnowledgeResponseSchema = t.Union([
  KnowledgePreviewResponseSchema,
  KnowledgeFullResponseSchema,
]);
