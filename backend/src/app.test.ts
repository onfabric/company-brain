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

  it('creates brain.records with its upsert key and bm25 index', () => {
    const ddl = readFileSync(join(migrationsDir, '0002_create_brain_records.sql'), 'utf8');
    expect(ddl).toContain('CREATE TABLE brain.records');
    expect(ddl).toContain('UNIQUE (nango_connection_id, nango_model, nango_id)');
    expect(ddl).toContain('USING bm25');
  });

  it('widens the bm25 index with model and created_at for search filtering', () => {
    const ddl = readFileSync(join(migrationsDir, '0003_extend_brain_records_bm25.sql'), 'utf8');
    expect(ddl).toContain('DROP INDEX brain.records_bm25_idx');
    expect(ddl).toContain('bm25 (id, body, data_source_id, nango_model, created_at, updated_at)');
  });
});

describe('app', () => {
  it('builds the Elysia app without a database connection', async () => {
    const { createApp } = await import('#app.ts');
    expect(createApp()).toBeDefined();
  });
});
