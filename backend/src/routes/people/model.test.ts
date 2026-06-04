import { describe, expect, it } from 'bun:test';
import { Elysia, StatusMap } from 'elysia';
import { ListPeopleQuerySchema } from '#routes/people/model.ts';

const VALID = StatusMap.OK;
const INVALID = StatusMap['Unprocessable Content'];

const app = new Elysia()
  .get('/people', ({ query }) => String(query.is_external), { query: ListPeopleQuerySchema })
  .compile();

async function listPeople(qs: string): Promise<{ status: number; body: string }> {
  const res = await app.handle(new Request(`http://localhost/people${qs}`));
  return { status: res.status, body: await res.text() };
}

describe('ListPeopleQuerySchema', () => {
  it('omits the filter when is_external is absent', async () => {
    const { status, body } = await listPeople('');
    expect(status).toBe(VALID);
    expect(body).toBe('undefined');
  });

  it('coerces is_external to a boolean', async () => {
    expect(await listPeople('?is_external=true')).toEqual({ status: VALID, body: 'true' });
    expect(await listPeople('?is_external=false')).toEqual({ status: VALID, body: 'false' });
  });

  it('rejects a non-boolean is_external', async () => {
    expect((await listPeople('?is_external=maybe')).status).toBe(INVALID);
  });
});
