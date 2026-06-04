import { t } from 'elysia';

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
});

export const ListPeopleResponseSchema = t.Object({
  people: t.Array(PersonSchema),
});
