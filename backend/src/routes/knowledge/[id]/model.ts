import { t } from 'elysia';
import { KnowledgeSchema } from '#routes/knowledge/model.ts';

export const KnowledgeParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const KnowledgeItemResponseSchema = KnowledgeSchema;
