import { t } from 'elysia';
import { PERSON_SORT_FIELDS, PERSON_SORT_ORDERS } from '#repositories/people.repository.ts';

const PersonSortFieldSchema = t.Union(
  PERSON_SORT_FIELDS.map((field) => t.Literal(field)),
  {
    description: 'Field used to order people. Defaults to name.',
  },
);

const PersonSortOrderSchema = t.Union(
  PERSON_SORT_ORDERS.map((order) => t.Literal(order)),
  {
    description: 'Direction used for the selected sort field.',
  },
);

export const PersonDataSourceSchema = t.Object({
  data_source_key: t.String({
    description: 'Key identifying the data source this person was seen in (e.g. the integration).',
  }),
  data_source_user_id: t.String({
    description: 'The person’s native user identifier within that data source.',
  }),
});

export const PersonSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.Union([t.String(), t.Null()]),
  email: t.Union([t.String(), t.Null()]),
  is_external: t.Boolean({
    description: 'Whether this person is external to the company rather than a team member.',
  }),
  data_sources: t.Array(PersonDataSourceSchema, {
    description:
      'The data sources this person has been identified in, with their native id in each.',
  }),
  records_count: t.Integer({
    description: 'Number of ingested records attributed to this person.',
  }),
});

export const ListPeopleQuerySchema = t.Object({
  is_external: t.Optional(
    t.Boolean({
      description: 'Filter to only external (true) or only internal (false) people. Omit for all.',
    }),
  ),
  sort_by: t.Optional(PersonSortFieldSchema),
  sort_order: t.Optional(PersonSortOrderSchema),
});

export const ListPeopleResponseSchema = t.Object({
  people: t.Array(PersonSchema),
});
