import { t } from 'elysia';

export const PersonDataSourceSchema = t.Object({
  data_source_key: t.String(),
  data_source_user_id: t.String(),
});

export const PersonSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.Union([t.String(), t.Null()]),
  email: t.Union([t.String(), t.Null()]),
  is_external: t.Boolean(),
  data_sources: t.Array(PersonDataSourceSchema),
});

export const ListPeopleQuerySchema = t.Object({
  is_external: t.Optional(t.Boolean()),
});

export const ListPeopleResponseSchema = t.Object({
  people: t.Array(PersonSchema),
});

export const UpdatePersonParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const UpdatePersonBodySchema = t.Object(
  {
    name: t.Optional(t.Union([t.Null(), t.String({ minLength: 1 })])),
    email: t.Optional(t.Union([t.Null(), t.String({ format: 'email' })])),
    is_external: t.Optional(t.Boolean()),
  },
  { minProperties: 1 },
);

export const UpdatePersonResponseSchema = PersonSchema;
