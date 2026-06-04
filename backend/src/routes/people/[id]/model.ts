import { t } from 'elysia';
import { PersonSchema } from '#routes/people/model.ts';

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
