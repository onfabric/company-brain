import { describe, expect, it } from 'bun:test';
import { Elysia, StatusMap } from 'elysia';
import { CreateKnowledgeBodySchema, KnowledgeQuerySchema } from '#routes/api/knowledge/model.ts';

const VALID = StatusMap.OK;
const INVALID = StatusMap['Unprocessable Content'];

const app = new Elysia()
  .get('/knowledge', ({ query }) => JSON.stringify(query), { query: KnowledgeQuerySchema })
  .post('/knowledge', ({ body }) => JSON.stringify(body), { body: CreateKnowledgeBodySchema })
  .compile();

async function search(qs: string): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(new Request(`http://localhost/knowledge${qs}`));
  return { status: res.status, body: await res.json() };
}

async function create(body: unknown): Promise<number> {
  const res = await app.handle(
    new Request('http://localhost/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return res.status;
}

const TYPE_ID = '019e8000-0000-7000-8000-000000000001';

describe('KnowledgeQuerySchema', () => {
  it('defaults limit and offset when absent', async () => {
    const { status, body } = await search('');
    expect(status).toBe(VALID);
    expect(body).toEqual({ limit: 20, offset: 0, view: 'preview' });
  });

  it('accepts the knowledge sort fields', async () => {
    expect((await search('?q=pricing&sort_by=relevance&sort_order=desc')).status).toBe(VALID);
    expect((await search('?sort_by=created_at&sort_order=asc')).status).toBe(VALID);
  });

  it('accepts preview and full result views', async () => {
    expect((await search('?view=preview')).status).toBe(VALID);
    expect((await search('?view=full')).status).toBe(VALID);
  });

  it('rejects an unknown result view', async () => {
    expect((await search('?view=summary')).status).toBe(INVALID);
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

describe('CreateKnowledgeBodySchema', () => {
  it('accepts a minimal body and defaults the link arrays', async () => {
    expect(await create({ title: 'T', body: 'B', knowledge_type_id: TYPE_ID })).toBe(VALID);
  });

  it('rejects an empty title', async () => {
    expect(await create({ title: '', body: 'B', knowledge_type_id: TYPE_ID })).toBe(INVALID);
  });

  it('rejects a missing knowledge_type_id', async () => {
    expect(await create({ title: 'T', body: 'B' })).toBe(INVALID);
  });

  it('rejects a non-uuid in person_ids', async () => {
    expect(
      await create({ title: 'T', body: 'B', knowledge_type_id: TYPE_ID, person_ids: ['nope'] }),
    ).toBe(INVALID);
  });
});
