import { t } from 'elysia';
import { PersonSchema } from '#routes/people/model.ts';

export const MergePeopleBodySchema = t.Object({
  merge_from_id: t.String({
    format: 'uuid',
    description: 'Person to merge from; deleted once their data is moved.',
  }),
  merge_into_id: t.String({
    format: 'uuid',
    description: 'Person to merge into; survives and receives the moved data.',
  }),
});

export const MergePeopleResponseSchema = t.Object({
  person: PersonSchema,
  moved_data_sources: t.Integer({
    description: 'Number of data source links moved from the source to the target person.',
  }),
  moved_records: t.Integer({
    description: 'Number of records reattributed from the source to the target person.',
  }),
});
