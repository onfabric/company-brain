import { describe, expect, it } from 'bun:test';
import { Elysia, StatusMap } from 'elysia';
import { KnowledgeQuerySchema } from '#routes/knowledge/model.ts';

const VALID = StatusMap.OK;
const INVALID = StatusMap['Unprocessable Content'];

const app = new Elysia()
  .get('/knowledge', ({ query }) => JSON.stringify(query), { query: KnowledgeQuerySchema })
  .compile();

async function search(qs: string): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(new Request(`http://localhost/knowledge${qs}`));
  return { status: res.status, body: await res.json() };
}

describe('KnowledgeQuerySchema', () => {
  it('defaults limit and offset when absent', async () => {
    const { status, body } = await search('');
    expect(status).toBe(VALID);
    expect(body).toEqual({ limit: 20, offset: 0 });
  });

  it('accepts the knowledge sort fields', async () => {
    expect((await search('?q=pricing&sort_by=relevance&sort_order=desc')).status).toBe(VALID);
    expect((await search('?sort_by=created_at&sort_order=asc')).status).toBe(VALID);
  });

  it('rejects an unknown sort field', async () => {
    expect((await search('?sort_by=title')).status).toBe(INVALID);
    expect((await search('?sort_by=updated_at')).status).toBe(INVALID);
  });

  it('rejects a non-uuid knowledge_type_id', async () => {
    expect((await search('?knowledge_type_id=not-a-uuid')).status).toBe(INVALID);
  });

  it('collects repeated person_id into an array', async () => {
    const { status, body } = await search(
      '?person_id=019e8882-07f1-771c-993e-f6825a9224bb&person_id=019e8882-07f1-77a0-b4cf-5798eafb4664',
    );
    expect(status).toBe(VALID);
    expect((body as { person_id: string[] }).person_id).toHaveLength(2);
  });
});
