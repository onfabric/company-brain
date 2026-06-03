import { t } from 'elysia';
import { PersonSchema } from '#routes/people/model.ts';

export const MergePeopleBodySchema = t.Object({
  merge_from_id: t.String({ format: 'uuid' }),
  merge_into_id: t.String({ format: 'uuid' }),
});

export const MergePeopleResponseSchema = t.Object({
  person: PersonSchema,
  moved_data_sources: t.Integer(),
  moved_records: t.Integer(),
});
