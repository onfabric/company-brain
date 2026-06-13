import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { SQL } from 'bun';
import { bunSqlAdapter } from '#lib/auth-adapter.ts';

const migrationsDir = join(import.meta.dir, '..', 'db', 'migrations');
const readMigration = (file: string): Promise<string> => Bun.file(join(migrationsDir, file)).text();

// PGlite resolves a query to `{ rows, affectedRows }`; the Bun.sql adapter expects
// the rows array to carry `count` (affected rows). This shim bridges the two so
// the real adapter runs unmodified against in-memory Postgres.
function pgliteShim(db: PGlite): SQL {
  const unsafe = async (text: string, params: unknown[]) => {
    const result = await db.query(text, params);
    const rows = result.rows as Record<string, unknown>[] & { count: number };
    rows.count = result.affectedRows ?? 0;
    return rows;
  };
  return { unsafe } as unknown as SQL;
}

async function migrate(db: PGlite): Promise<void> {
  await db.exec(await readMigration('0011_create_auth_schema.sql'));
  // 0012 opens with `SET LOCAL search_path TO auth`, which only scopes inside a
  // transaction.
  const betterAuthTables = await readMigration('0012_create_better_auth_tables.sql');
  await db.transaction(async (tx) => {
    await tx.exec(betterAuthTables);
  });
}

type Adapter = ReturnType<ReturnType<typeof bunSqlAdapter>>;

const ONE_HOUR_MS = 3_600_000;

function newUser() {
  const id = Bun.randomUUIDv7();
  return {
    id,
    name: `user-${id}`,
    email: `user-${id}@email.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function newSession(userId: string) {
  const id = Bun.randomUUIDv7();
  return {
    id,
    expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    token: Bun.randomUUIDv7(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'Some User Agent',
    userId,
  };
}

let db: PGlite;
let adapter: Adapter;

const insertUser = () => adapter.create({ model: 'user', data: newUser(), forceAllowId: true });
const insertSession = async () => {
  const user = await insertUser();
  const session = await adapter.create({
    model: 'session',
    data: newSession(user.id),
    forceAllowId: true,
  });
  return { user, session };
};

beforeAll(async () => {
  db = new PGlite();
  await migrate(db);
  adapter = bunSqlAdapter(pgliteShim(db))({} as Parameters<ReturnType<typeof bunSqlAdapter>>[0]);
});

afterAll(async () => {
  await db.close();
});

// The base-model CRUD surface the Bun.sql adapter implements, exercised against
// the real auth.* schema in in-memory Postgres so the rendered SQL, type
// coercions and affected-row counts are checked end to end.
describe('bun-sql adapter against pglite', () => {
  it('creates and reads back a user with booleans and dates', async () => {
    const user = newUser();
    const created = await adapter.create({ model: 'user', data: user, forceAllowId: true });
    expect(created.id).toBe(user.id);
    expect(created.emailVerified).toBe(user.emailVerified);
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await adapter.findOne<typeof created>({
      model: 'user',
      where: [{ field: 'id', value: user.id }],
    });
    expect(found?.email).toBe(user.email);
  });

  it('matches email case-insensitively', async () => {
    const user = await insertUser();
    const found = await adapter.findOne<typeof user>({
      model: 'user',
      where: [
        { field: 'email', value: user.email.toUpperCase(), operator: 'eq', mode: 'insensitive' },
      ],
    });
    expect(found?.id).toBe(user.id);
  });

  it('finds many sorted and paginated', async () => {
    const a = await insertUser();
    const b = await insertUser();
    const sorted = [a, b].sort((x, y) => x.id.localeCompare(y.id));
    const page = await adapter.findMany<typeof a>({
      model: 'user',
      sortBy: { field: 'id', direction: 'asc' },
      limit: 1,
      offset: 0,
      where: [{ field: 'id', value: [a.id, b.id], operator: 'in' }],
    });
    expect(page).toHaveLength(1);
    expect(page[0]?.id).toBe(sorted[0]?.id);
  });

  it('counts rows behind a where guard', async () => {
    const user = await insertUser();
    const total = await adapter.count({
      model: 'user',
      where: [{ field: 'id', value: user.id }],
    });
    expect(total).toBe(1);
  });

  it('updates a single row and returns it', async () => {
    const user = await insertUser();
    const updated = await adapter.update<typeof user>({
      model: 'user',
      where: [{ field: 'id', value: user.id }],
      update: { name: 'Renamed' },
    });
    expect(updated?.name).toBe('Renamed');
  });

  it('reports affected-row counts from updateMany and deleteMany', async () => {
    const { user } = await insertSession();
    const renamed = await adapter.updateMany({
      model: 'session',
      where: [{ field: 'userId', value: user.id }],
      update: { userAgent: 'agent' },
    });
    expect(renamed).toBe(1);

    const removed = await adapter.deleteMany({
      model: 'session',
      where: [{ field: 'userId', value: user.id }],
    });
    expect(removed).toBe(1);
  });

  it('deletes a single row', async () => {
    const user = await insertUser();
    await adapter.delete({ model: 'user', where: [{ field: 'id', value: user.id }] });
    const found = await adapter.findOne({
      model: 'user',
      where: [{ field: 'id', value: user.id }],
    });
    expect(found).toBeNull();
  });
});
