import { t } from 'elysia';
import { KnowledgeTypeSchema } from '#routes/api/knowledge-types/model.ts';

export const KnowledgeTypeParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const UpdateKnowledgeTypeBodySchema = t.Object({
  name: t.String({ minLength: 1, description: 'New name for the knowledge type.' }),
});

export const KnowledgeTypeResponseSchema = KnowledgeTypeSchema;

export const DeleteKnowledgeTypeResponseSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});
