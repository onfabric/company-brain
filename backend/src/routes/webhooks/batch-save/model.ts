import { t } from 'elysia';

export const BatchSaveBodySchema = t.Object({
  data_source_id: t.String({ minLength: 1 }),
  connection_id: t.Integer(),
  model: t.String({ minLength: 1 }),
  ids: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
});

export const BatchSaveResponseSchema = t.Object({
  ingested: t.Number(),
});
