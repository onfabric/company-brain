import { type Static, t } from 'elysia';

export const UnauthorizedErrorSchema = t.Object({ error: t.String() });

export const UNAUTHORIZED_ERROR: Static<typeof UnauthorizedErrorSchema> = { error: 'Unauthorized' };
