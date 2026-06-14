import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StatusMap } from 'elysia';

const testEnv = process.env as Record<string, string | undefined>;
testEnv.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
testEnv.BRAIN_API_KEY ??= '00000000-0000-4000-8000-000000000000';
testEnv.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-0000000000000000';
testEnv.GOOGLE_CLIENT_ID ??= 'test-google-client-id';
testEnv.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret';
testEnv.BRAIN_PUBLIC_URL ??= 'http://localhost:18851';

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

  it('normalizes the integration identifier into brain.data_sources', () => {
    const ddl = readFileSync(join(migrationsDir, '0004_create_brain_data_sources.sql'), 'utf8');
    expect(ddl).toContain('CREATE TABLE brain.data_sources');
    expect(ddl).toContain('nango_integration_id text NOT NULL UNIQUE');
    expect(ddl).toContain('RENAME COLUMN data_source_id TO nango_integration_id');
    expect(ddl).toContain('ADD COLUMN data_source_id uuid REFERENCES brain.data_sources (id)');
    expect(ddl).toContain('bm25 (id, body, data_source_id, nango_model, created_at, updated_at)');
  });

  it('drops the legacy nango_integration_id from records', () => {
    const ddl = readFileSync(
      join(migrationsDir, '0005_drop_records_nango_integration_id.sql'),
      'utf8',
    );
    expect(ddl).toContain('ALTER COLUMN data_source_id SET NOT NULL');
    expect(ddl).toContain('DROP COLUMN nango_integration_id');
  });
});

describe('app', () => {
  it('builds the Elysia app without a database connection', async () => {
    const { createApp } = await import('#app.ts');
    expect(createApp()).toBeDefined();
  });
});

describe('api key auth', () => {
  it('rejects a protected route without a valid api key', async () => {
    const { createApp } = await import('#app.ts');
    const res = await createApp().handle(new Request('http://localhost/api/people'));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('lets a protected route past auth with a valid api key', async () => {
    const { createApp } = await import('#app.ts');
    const { API_KEY_HEADER } = await import('#lib/auth/api-key.ts');
    const res = await createApp().handle(
      new Request('http://localhost/api/people', {
        headers: { [API_KEY_HEADER]: '00000000-0000-4000-8000-000000000000' },
      }),
    );
    expect(res.status).not.toBe(StatusMap.Unauthorized);
  });

  it('lets a knowledge page past auth with a valid api key', async () => {
    const { createApp } = await import('#app.ts');
    const { API_KEY_HEADER } = await import('#lib/auth/api-key.ts');
    const res = await createApp().handle(
      new Request('http://localhost/api/knowledge/pages/index', {
        headers: { [API_KEY_HEADER]: '00000000-0000-4000-8000-000000000000' },
      }),
    );
    expect(res.status).not.toBe(StatusMap.Unauthorized);
  });

  it('rejects navigable knowledge pages without api key or session', async () => {
    const { createApp } = await import('#app.ts');
    const res = await createApp().handle(
      new Request('http://localhost/api/knowledge/pages/019e8882-07f1-771c-993e-f6825a9224bb'),
    );
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('rejects the knowledge index page without api key or session', async () => {
    const { createApp } = await import('#app.ts');
    const res = await createApp().handle(new Request('http://localhost/api/knowledge/pages/index'));
    expect(res.status).toBe(StatusMap.Unauthorized);
  });

  it('leaves the internal webhook open to in-network callers', async () => {
    const { createApp } = await import('#app.ts');
    const res = await createApp().handle(
      new Request('http://localhost/internal/webhooks/batch-save', { method: 'POST' }),
    );
    expect(res.status).not.toBe(StatusMap.Unauthorized);
  });

  it('rejects a protected route with an invalid session cookie', async () => {
    const { createApp } = await import('#app.ts');
    const res = await createApp().handle(
      new Request('http://localhost/api/people', {
        headers: { cookie: 'better-auth.session_token=not-a-real-session' },
      }),
    );
    expect(res.status).toBe(StatusMap.Unauthorized);
  });
});
