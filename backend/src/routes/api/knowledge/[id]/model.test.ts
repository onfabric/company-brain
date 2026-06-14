import { describe, expect, it } from 'bun:test';
import { Elysia, StatusMap } from 'elysia';
import { UpdateKnowledgeBodySchema } from '#routes/api/knowledge/[id]/model.ts';

const VALID = StatusMap.OK;
const INVALID = StatusMap['Unprocessable Content'];

const TYPE_ID = '019e8000-0000-7000-8000-000000000001';
const PERSON_ID = '019e9000-0000-7000-8000-00000000000a';

const app = new Elysia()
  .patch('/knowledge/:id', () => 'ok', { body: UpdateKnowledgeBodySchema })
  .compile();

async function patch(body: unknown): Promise<number> {
  const res = await app.handle(
    new Request('http://localhost/knowledge/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return res.status;
}

describe('UpdateKnowledgeBodySchema', () => {
  it('accepts a partial update with any single field', async () => {
    expect(await patch({ title: 'New title' })).toBe(VALID);
    expect(await patch({ body: '<p>New body</p>' })).toBe(VALID);
    expect(await patch({ knowledge_type_id: TYPE_ID })).toBe(VALID);
    expect(await patch({ person_ids: [PERSON_ID] })).toBe(VALID);
    expect(await patch({ record_ids: [] })).toBe(VALID);
  });

  it('rejects a body with no fields', async () => {
    expect(await patch({})).toBe(INVALID);
  });

  it('rejects an empty title, an empty body, and non-uuid link ids', async () => {
    expect(await patch({ title: '' })).toBe(INVALID);
    expect(await patch({ body: '' })).toBe(INVALID);
    expect(await patch({ knowledge_type_id: 'nope' })).toBe(INVALID);
    expect(await patch({ person_ids: ['nope'] })).toBe(INVALID);
  });
});
