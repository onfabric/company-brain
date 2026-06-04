import { describe, expect, it } from 'bun:test';
import { Elysia, StatusMap } from 'elysia';
import { ListPeopleQuerySchema } from '#routes/people/model.ts';

const VALID = StatusMap.OK;
const INVALID = StatusMap['Unprocessable Content'];

const app = new Elysia()
  .get('/people', ({ query }) => JSON.stringify(query), { query: ListPeopleQuerySchema })
  .compile();

async function listPeople(qs: string): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(new Request(`http://localhost/people${qs}`));
  return { status: res.status, body: await res.json() };
}

describe('ListPeopleQuerySchema', () => {
  it('omits the filter when is_external is absent', async () => {
    const { status, body } = await listPeople('');
    expect(status).toBe(VALID);
    expect(body).toEqual({});
  });

  it('coerces is_external to a boolean', async () => {
    expect(await listPeople('?is_external=true')).toEqual({
      status: VALID,
      body: { is_external: true },
    });
    expect(await listPeople('?is_external=false')).toEqual({
      status: VALID,
      body: { is_external: false },
    });
  });

  it('rejects a non-boolean is_external', async () => {
    expect((await listPeople('?is_external=maybe')).status).toBe(INVALID);
  });

  it('accepts people sort fields and order', async () => {
    expect(await listPeople('?sort_by=records_count&sort_order=desc')).toEqual({
      status: VALID,
      body: { sort_by: 'records_count', sort_order: 'desc' },
    });
  });

  it('rejects unknown people sort options', async () => {
    expect((await listPeople('?sort_by=email')).status).toBe(INVALID);
    expect((await listPeople('?sort_order=sideways')).status).toBe(INVALID);
  });
});
