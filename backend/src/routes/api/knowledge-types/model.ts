import { t } from 'elysia';

export const KnowledgeTypeSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.String(),
});

export const CreateKnowledgeTypeBodySchema = t.Object({
  name: t.String({ minLength: 1, description: 'Unique name of the knowledge type.' }),
});

export const ListKnowledgeTypesResponseSchema = t.Object({
  knowledge_types: t.Array(KnowledgeTypeSchema),
});
