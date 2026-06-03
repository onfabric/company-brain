import { t } from 'elysia';

export const PersonDataSourceSchema = t.Object({
  data_source_key: t.String(),
  data_source_user_id: t.String(),
});

export const PersonSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.Union([t.String(), t.Null()]),
  email: t.Union([t.String(), t.Null()]),
  data_sources: t.Array(PersonDataSourceSchema),
});

export const ListPeopleResponseSchema = t.Object({
  people: t.Array(PersonSchema),
});

const NullableNonTrivialString = t.Union([t.Null(), t.String({ minLength: 2 })]);

export const UpdatePersonParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const UpdatePersonBodySchema = t.Object({
  name: t.Optional(NullableNonTrivialString),
  email: t.Optional(NullableNonTrivialString),
});

export const UpdatePersonResponseSchema = PersonSchema;
