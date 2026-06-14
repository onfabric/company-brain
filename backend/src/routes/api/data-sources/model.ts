import { t } from 'elysia';

export const SourceSchema = t.Object({
  data_source_id: t.String({ format: 'uuid' }),
  data_source_key: t.String(),
  count: t.Integer(),
  oldest_created_at: t.String({ format: 'date-time' }),
  newest_created_at: t.String({ format: 'date-time' }),
  newest_updated_at: t.String({ format: 'date-time' }),
});

export const ListSourcesResponseSchema = t.Object({
  sources: t.Array(SourceSchema),
});
