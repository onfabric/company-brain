import { t } from 'elysia';

export const SearchQuerySchema = t.Object({
  q: t.Optional(t.String({ minLength: 1 })),
  data_source_id: t.Optional(t.String({ format: 'uuid' })),
  person_id: t.Optional(t.Array(t.String({ format: 'uuid' }), { minItems: 1 })),
  model: t.Optional(t.String({ minLength: 1 })),
  created_after: t.Optional(t.String({ format: 'date-time' })),
  created_before: t.Optional(t.String({ format: 'date-time' })),
  updated_after: t.Optional(t.String({ format: 'date-time' })),
  updated_before: t.Optional(t.String({ format: 'date-time' })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
});

export const SearchHitSchema = t.Object({
  id: t.String(),
  data_source_id: t.String({ format: 'uuid' }),
  model: t.String(),
  created_at: t.String({ format: 'date-time' }),
  updated_at: t.String({ format: 'date-time' }),
  score: t.Union([t.Number(), t.Null()]),
  snippet: t.Union([t.String(), t.Null()]),
  body: t.String(),
});

export const SearchResponseSchema = t.Object({
  total: t.Integer(),
  limit: t.Integer(),
  offset: t.Integer(),
  results: t.Array(SearchHitSchema),
});
