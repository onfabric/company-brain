import { t } from 'elysia';
import { RECORD_SORT_FIELDS, RECORD_SORT_ORDERS } from '#repositories/records.repository.ts';

const RecordSortFieldSchema = t.Union(
  RECORD_SORT_FIELDS.map((field) => t.Literal(field)),
  {
    description:
      'Field used to order records. Defaults to relevance when q is present, otherwise created_at.',
  },
);

const RecordSortOrderSchema = t.Union(
  RECORD_SORT_ORDERS.map((order) => t.Literal(order)),
  {
    description: 'Direction used for the selected sort field.',
  },
);

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
  sort_by: t.Optional(RecordSortFieldSchema),
  sort_order: t.Optional(RecordSortOrderSchema),
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

export const RecordSchema = t.Object({
  id: t.String(),
  data_source_id: t.String({ format: 'uuid' }),
  data_source_key: t.String(),
  created_at: t.String({ format: 'date-time' }),
  updated_at: t.String({ format: 'date-time' }),
  body: t.String({ description: 'Full textual content of the record.' }),
  participants: t.Array(
    t.Object({
      id: t.String({ format: 'uuid' }),
      name: t.Union([t.String(), t.Null()]),
      email: t.Union([t.String(), t.Null()]),
      is_external: t.Boolean(),
      handle: t.Union([t.String(), t.Null()], {
        description:
          'A representative per-source identifier, for display when name and email are absent.',
      }),
    }),
  ),
});

export const RecordHitSchema = t.Composite([
  RecordSchema,
  t.Object({
    score: t.Union([t.Number(), t.Null()], {
      description: 'Relevance score for the full-text query; null when no query was given.',
    }),
    snippet: t.Union([t.String(), t.Null()], {
      description: 'Highlighted excerpt of the match; null when no query was given.',
    }),
  }),
]);

export const RecordsResponseSchema = t.Object({
  total: t.Union([t.Integer(), t.Null()], {
    description:
      'Total number of records matching the filters, ignoring pagination. Returned on the first page (offset 0); null on later pages to avoid recounting while scrolling.',
  }),
  limit: t.Integer(),
  offset: t.Integer(),
  results: t.Array(RecordHitSchema),
});

export const RecordsFilesystemQuerySchema = t.Object({
  data_source_id: t.Optional(
    t.String({ format: 'uuid', description: 'Open a provider folder by data source id.' }),
  ),
  day: t.Optional(
    t.String({
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      description: 'Open a UTC day folder within a provider, formatted as YYYY-MM-DD.',
    }),
  ),
  person_id: t.Optional(
    t.String({
      minLength: 1,
      description: 'Open a participant folder by person id, or "none" for records without people.',
    }),
  ),
  limit: t.Optional(
    t.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Maximum number of record files to return from a participant folder.',
    }),
  ),
  offset: t.Optional(
    t.Integer({
      minimum: 0,
      default: 0,
      description: 'Number of record files to skip in a participant folder.',
    }),
  ),
});

export const RecordFilesystemFolderSchema = t.Object({
  type: t.Union([t.Literal('provider'), t.Literal('day'), t.Literal('participant')]),
  id: t.String(),
  name: t.String(),
  count: t.Integer(),
});

export const RecordsFilesystemResponseSchema = t.Object({
  path: t.Object({
    data_source_id: t.Optional(t.String({ format: 'uuid' })),
    data_source_key: t.Optional(t.String()),
    day: t.Optional(t.String()),
    person_id: t.Optional(t.String()),
    participant_name: t.Optional(t.String()),
  }),
  total: t.Integer(),
  limit: t.Integer(),
  offset: t.Integer(),
  folders: t.Array(RecordFilesystemFolderSchema),
  records: t.Array(RecordHitSchema),
});
