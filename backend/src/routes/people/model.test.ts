import { describe, expect, it } from 'bun:test';
import { Elysia, StatusMap } from 'elysia';
import { UpdatePersonBodySchema } from '#routes/people/model.ts';

const VALID = StatusMap.OK;
const INVALID = StatusMap['Unprocessable Content'];

const app = new Elysia()
  .patch('/people/:id', () => 'ok', { body: UpdatePersonBodySchema })
  .compile();

async function patch(body: unknown): Promise<number> {
  const res = await app.handle(
    new Request('http://localhost/people/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return res.status;
}

describe('UpdatePersonBodySchema', () => {
  it('accepts a partial update with either field, including nulls', async () => {
    expect(await patch({ name: 'Ada' })).toBe(VALID);
    expect(await patch({ email: 'ada@example.com' })).toBe(VALID);
    expect(await patch({ name: null, email: null })).toBe(VALID);
  });

  it('rejects a body with no fields', async () => {
    expect(await patch({})).toBe(INVALID);
  });

  it('rejects an empty name and a malformed email', async () => {
    expect(await patch({ name: '' })).toBe(INVALID);
    expect(await patch({ email: 'not-an-email' })).toBe(INVALID);
  });
});
