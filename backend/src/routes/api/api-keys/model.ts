import { t } from 'elysia';

export const ApiKeySchema = t.Object({
  id: t.String({ format: 'uuid' }),
  name: t.String(),
  key_prefix: t.String({
    description: 'Leading characters of the key, for recognising it in listings.',
  }),
  created_at: t.String({
    format: 'date-time',
    description: 'Derived from the uuidv7 id; the moment the key was created.',
  }),
  updated_at: t.String({ format: 'date-time', description: 'Last time the key was modified.' }),
});

export const CreatedApiKeySchema = t.Composite([
  ApiKeySchema,
  t.Object({
    key: t.String({
      description: 'The full API key. Shown only once, at creation time, and never recoverable.',
    }),
  }),
]);

export const CreateApiKeyBodySchema = t.Object({
  name: t.String({ minLength: 1, description: 'Human-readable label for the API key.' }),
});

export const ListApiKeysResponseSchema = t.Object({
  api_keys: t.Array(ApiKeySchema),
});
