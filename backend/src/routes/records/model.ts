import { t } from 'elysia';

export const RecordsQuerySchema = t.Object({
  q: t.Optional(
    t.String({
      minLength: 1,
      description: 'Full-text query. Omit to list records matching the other filters.',
    }),
  ),
  data_source_id: t.Optional(
    t.String({ format: 'uuid', description: 'Restrict results to a single data source.' }),
  ),
  person_id: t.Optional(
    t.Array(t.String({ format: 'uuid' }), {
      minItems: 1,
      description: 'Restrict results to records attributed to any of these people.',
    }),
  ),
  model: t.Optional(
    t.String({
      minLength: 1,
      description: 'Restrict results to a single record model (record type).',
    }),
  ),
  created_after: t.Optional(
    t.String({ format: 'date-time', description: 'Only records created at or after this time.' }),
  ),
  created_before: t.Optional(
    t.String({ format: 'date-time', description: 'Only records created at or before this time.' }),
  ),
  updated_after: t.Optional(
    t.String({ format: 'date-time', description: 'Only records updated at or after this time.' }),
  ),
  updated_before: t.Optional(
    t.String({ format: 'date-time', description: 'Only records updated at or before this time.' }),
  ),
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

export const RecordHitSchema = t.Object({
  id: t.String(),
  data_source_id: t.String({ format: 'uuid' }),
  model: t.String({ description: 'The record model (record type) this hit belongs to.' }),
  created_at: t.String({ format: 'date-time' }),
  updated_at: t.String({ format: 'date-time' }),
  score: t.Union([t.Number(), t.Null()], {
    description: 'Relevance score for the full-text query; null when no query was given.',
  }),
  snippet: t.Union([t.String(), t.Null()], {
    description: 'Highlighted excerpt of the match; null when no query was given.',
  }),
  body: t.String({ description: 'Full textual content of the record.' }),
});

export const RecordsResponseSchema = t.Object({
  total: t.Integer({
    description: 'Total number of records matching the filters, ignoring pagination.',
  }),
  limit: t.Integer(),
  offset: t.Integer(),
  results: t.Array(RecordHitSchema),
});
