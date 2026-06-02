import { t } from 'elysia';

export const SourceModelSchema = t.Object({
  model: t.String(),
  count: t.Integer(),
  oldest_created_at: t.String({ format: 'date-time' }),
  newest_created_at: t.String({ format: 'date-time' }),
  newest_updated_at: t.String({ format: 'date-time' }),
});

export const SourceSchema = t.Object({
  data_source_id: t.String(),
  count: t.Integer(),
  models: t.Array(SourceModelSchema),
});

export const ListSourcesResponseSchema = t.Object({
  sources: t.Array(SourceSchema),
});
