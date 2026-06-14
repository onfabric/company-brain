import { describe, expect, it } from 'bun:test';
import { Elysia, StatusMap } from 'elysia';
import { CreateKnowledgeTypeBodySchema } from '#routes/api/knowledge-types/model.ts';

const VALID = StatusMap.OK;
const INVALID = StatusMap['Unprocessable Content'];

const app = new Elysia()
  .post('/knowledge-types', ({ body }) => JSON.stringify(body), {
    body: CreateKnowledgeTypeBodySchema,
  })
  .compile();

async function create(body: unknown): Promise<number> {
  const res = await app.handle(
    new Request('http://localhost/knowledge-types', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return res.status;
}

describe('CreateKnowledgeTypeBodySchema', () => {
  it('accepts a non-empty name', async () => {
    expect(await create({ name: 'meeting-note' })).toBe(VALID);
  });

  it('rejects an empty name', async () => {
    expect(await create({ name: '' })).toBe(INVALID);
  });

  it('rejects a missing name', async () => {
    expect(await create({})).toBe(INVALID);
  });
});
