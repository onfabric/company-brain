import { describe, expect, it } from 'bun:test';
import type { SQL } from 'bun';
import { bunSqlAdapter } from '#lib/auth/adapter.ts';

type Call = { text: string; params: unknown[] };

// A fake Bun.sql whose `unsafe` records the rendered SQL and bound params and
// returns canned rows carrying the affected-row `count` Bun.sql exposes.
function fakeSql(rows: Record<string, unknown>[] = [], count = rows.length) {
  const calls: Call[] = [];
  const unsafe = (text: string, params: unknown[]) => {
    calls.push({ text, params });
    const result = [...rows] as Record<string, unknown>[] & { count: number };
    result.count = count;
    return Promise.resolve(result);
  };
  return { sql: { unsafe } as unknown as SQL, calls };
}

// The adapter factory is generic over options; an empty object is enough for
// these query-shape assertions.
function makeAdapter(sql: SQL) {
  return bunSqlAdapter(sql)({} as Parameters<ReturnType<typeof bunSqlAdapter>>[0]);
}

const last = (calls: Call[]): Call => calls[calls.length - 1] as Call;

describe('bun sql adapter', () => {
  it('builds a schema-qualified INSERT ... RETURNING with one placeholder per column', async () => {
    const { sql, calls } = fakeSql([{ id: 'u1' }]);
    const adapter = makeAdapter(sql);

    await adapter.create({
      model: 'user',
      data: { id: 'u1', email: 'a@onfabric.io', emailVerified: true },
    });

    // The factory injects schema defaults (createdAt/updatedAt) before the
    // adapter sees the row, so assert the shape and that the supplied columns
    // and their bound values line up, not the full column set.
    const { text, params } = last(calls);
    expect(text).toMatch(
      /^INSERT INTO auth\."user" \((("[^"]+", )*"[^"]+")\) VALUES \((\$\d+, )*\$\d+\) RETURNING \*$/,
    );
    const columnList = text.match(/\(([^)]*)\) VALUES/)?.[1] ?? '';
    const columns = columnList.split(', ');
    expect(columns).toContain('"id"');
    expect(columns).toContain('"email"');
    expect(columns).toContain('"emailVerified"');
    expect(params).toHaveLength(columns.length);
    expect(params[columns.indexOf('"email"')]).toBe('a@onfabric.io');
    expect(params[columns.indexOf('"emailVerified"')]).toBe(true);
  });

  it('renders eq/null/AND in findOne and selects requested columns', async () => {
    const { sql, calls } = fakeSql([{ id: 'u1' }]);
    const adapter = makeAdapter(sql);

    await adapter.findOne({
      model: 'session',
      select: ['id', 'token'],
      where: [
        { field: 'userId', value: 'u1', operator: 'eq', connector: 'AND', mode: 'sensitive' },
        { field: 'ipAddress', value: null, operator: 'eq', connector: 'AND', mode: 'sensitive' },
      ],
    });

    const { text, params } = last(calls);
    expect(text).toBe(
      'SELECT "id", "token" FROM auth."session" WHERE "userId" = $1 AND "ipAddress" IS NULL LIMIT 1',
    );
    expect(params).toEqual(['u1']);
  });

  it('expands an in-list into a placeholder set', async () => {
    const { sql, calls } = fakeSql([]);
    const adapter = makeAdapter(sql);
    const limit = 50;
    const offset = 10;

    await adapter.findMany({
      model: 'user',
      limit,
      offset,
      sortBy: { field: 'createdAt', direction: 'desc' },
      where: [
        { field: 'id', value: ['a', 'b'], operator: 'in', connector: 'AND', mode: 'sensitive' },
      ],
    });

    const { text, params } = last(calls);
    expect(text).toBe(
      'SELECT * FROM auth."user" WHERE "id" IN ($1, $2) ORDER BY "createdAt" DESC LIMIT $3 OFFSET $4',
    );
    expect(params).toEqual(['a', 'b', limit, offset]);
  });

  it('degrades an empty in-list to a constant false', async () => {
    const { sql, calls } = fakeSql([]);
    const adapter = makeAdapter(sql);

    await adapter.findMany({
      model: 'user',
      limit: 100,
      where: [{ field: 'id', value: [], operator: 'in', connector: 'AND', mode: 'sensitive' }],
    });

    expect(last(calls).text).toBe('SELECT * FROM auth."user" WHERE FALSE LIMIT $1');
  });

  it('applies case-insensitive equality with lower() on both sides', async () => {
    const { sql, calls } = fakeSql([{ id: 'u1' }]);
    const adapter = makeAdapter(sql);

    await adapter.findOne({
      model: 'user',
      where: [
        {
          field: 'email',
          value: 'A@OnFabric.io',
          operator: 'eq',
          connector: 'AND',
          mode: 'insensitive',
        },
      ],
    });

    const { text, params } = last(calls);
    expect(text).toBe('SELECT * FROM auth."user" WHERE lower("email"::text) = lower($1) LIMIT 1');
    expect(params).toEqual(['A@OnFabric.io']);
  });

  it('builds an UPDATE ... RETURNING and returns the row', async () => {
    const { sql, calls } = fakeSql([{ id: 'u1', name: 'New' }]);
    const adapter = makeAdapter(sql);

    const row = await adapter.update({
      model: 'user',
      update: { name: 'New' },
      where: [{ field: 'id', value: 'u1', operator: 'eq', connector: 'AND', mode: 'sensitive' }],
    });

    // The factory adds an `updatedAt` touch to the SET clause; assert the
    // statement targets the right table and carries the `name` assignment and
    // the where guard rather than the exact column list.
    const { text, params } = last(calls);
    expect(text).toStartWith('UPDATE auth."user" SET ');
    expect(text).toContain('"name" = $1');
    expect(text).toMatch(/WHERE "id" = \$\d+ RETURNING \*$/);
    expect(params[0]).toBe('New');
    expect(params).toContain('u1');
    expect(row).toEqual({ id: 'u1', name: 'New' });
  });

  it('returns the affected-row count from updateMany and deleteMany', async () => {
    const updatedRows = 3;
    const updated = fakeSql([], updatedRows);
    const updateAdapter = makeAdapter(updated.sql);
    const count = await updateAdapter.updateMany({
      model: 'session',
      update: { token: 'x' },
      where: [
        { field: 'userId', value: 'u1', operator: 'eq', connector: 'AND', mode: 'sensitive' },
      ],
    });
    expect(updated.calls[0]?.text).toStartWith('UPDATE auth."session" SET ');
    expect(updated.calls[0]?.text).toContain('"token" = $1');
    expect(count).toBe(updatedRows);

    const deletedRows = 2;
    const deleted = fakeSql([], deletedRows);
    const deleteAdapter = makeAdapter(deleted.sql);
    const removed = await deleteAdapter.deleteMany({
      model: 'session',
      where: [
        { field: 'userId', value: 'u1', operator: 'eq', connector: 'AND', mode: 'sensitive' },
      ],
    });
    expect(deleted.calls[0]?.text).toBe('DELETE FROM auth."session" WHERE "userId" = $1');
    expect(removed).toBe(deletedRows);
  });

  it('counts rows with a COUNT(*) projection', async () => {
    const expectedCount = 7;
    const { sql, calls } = fakeSql([{ count: expectedCount }]);
    const adapter = makeAdapter(sql);

    const total = await adapter.count({ model: 'user' });

    expect(last(calls).text).toBe('SELECT count(*)::int AS count FROM auth."user"');
    expect(total).toBe(expectedCount);
  });
});
