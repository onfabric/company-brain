import { t } from 'elysia';
import { ApiKeySchema } from '#routes/api/api-keys/model.ts';

export const ApiKeyParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const UpdateApiKeyBodySchema = t.Object({
  name: t.String({ minLength: 1, description: 'New label for the API key.' }),
});

export const ApiKeyResponseSchema = ApiKeySchema;

export const DeleteApiKeyResponseSchema = t.Object({
  id: t.String({ format: 'uuid' }),
});
