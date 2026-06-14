import { t } from 'elysia';
import { RecordSchema } from '#routes/api/records/model.ts';

export const RecordParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const RecordResponseSchema = RecordSchema;
