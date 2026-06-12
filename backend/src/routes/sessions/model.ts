import { t } from 'elysia';

/**
 * Elysia can't validate empty-body responses with any other schema, so undefined is used.
 * @see https://github.com/elysiajs/elysia/issues/1738
 */
export const CreateSessionResponseSchema = t.Undefined();
