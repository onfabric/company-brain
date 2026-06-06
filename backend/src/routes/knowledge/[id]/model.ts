import { t } from 'elysia';
import { KnowledgeSchema } from '#routes/knowledge/model.ts';

export const KnowledgeParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const KnowledgeItemResponseSchema = KnowledgeSchema;

export const UpdateKnowledgeBodySchema = t.Object(
  {
    title: t.Optional(t.String({ minLength: 1, description: 'Short title of the knowledge.' })),
    body: t.Optional(
      t.String({
        minLength: 1,
        description:
          'Sanitized HTML fragment containing the full distilled content of the knowledge.',
      }),
    ),
    knowledge_type_id: t.Optional(t.String({ format: 'uuid' })),
    person_ids: t.Optional(
      t.Array(t.String({ format: 'uuid' }), {
        description: 'Replaces the full set of participants when present.',
      }),
    ),
    record_ids: t.Optional(
      t.Array(t.String({ format: 'uuid' }), {
        description: 'Replaces the full set of source records when present.',
      }),
    ),
  },
  {
    minProperties: 1,
    description:
      'Only the included fields are changed. person_ids and record_ids each replace the full set when present.',
  },
);

export const UpdateKnowledgeResponseSchema = KnowledgeSchema;
