import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';

const migrationsDir = join(import.meta.dir, 'db/migrations');

describe('migrations', () => {
  it('orders the brain-schema migration first', () => {
    const [first] = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    expect(first).toBe('0001_create_brain_schema.sql');
  });

  it('first migration creates the brain schema', () => {
    const ddl = readFileSync(join(migrationsDir, '0001_create_brain_schema.sql'), 'utf8');
    expect(ddl).toContain('CREATE SCHEMA IF NOT EXISTS brain');
  });
});

describe('app', () => {
  it('builds the Elysia app without a database connection', async () => {
    const { createApp } = await import('#app.ts');
    expect(createApp()).toBeDefined();
  });
});
