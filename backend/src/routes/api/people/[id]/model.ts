import { t } from 'elysia';
import { PersonSchema } from '#routes/api/people/model.ts';

export const PersonParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const UpdatePersonParamsSchema = PersonParamsSchema;

export const GetPersonResponseSchema = PersonSchema;

export const UpdatePersonBodySchema = t.Object(
  {
    name: t.Optional(t.Union([t.Null(), t.String({ minLength: 1 })])),
    email: t.Optional(t.Union([t.Null(), t.String({ format: 'email' })])),
    is_external: t.Optional(t.Boolean()),
  },
  { minProperties: 1 },
);

export const UpdatePersonResponseSchema = PersonSchema;
