import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SQL } from 'bun';
import { env } from '#lib/env.ts';
import { createLogger } from '#lib/logger.ts';

const MIGRATIONS_SCHEMA = 'backend_migrations';
const MIGRATIONS_TABLE = `${MIGRATIONS_SCHEMA}.migrations`;

const logger = createLogger('migrate');

// Migrations are placed next to the compiled binary by build.ts. In dev (running
// from source) the source dir exists on disk, so use it.
const sourceDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const migrationsDir = existsSync(sourceDir)
  ? sourceDir
  : join(dirname(process.execPath), 'migrations');

// The runner owns its own bookkeeping schema + table; migration files own the
// app schema(s). Keeping them separate means the runner never has to assume
// anything about the schema a migration creates.
async function ensureMigrationsTable(sql: SQL): Promise<void> {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${MIGRATIONS_SCHEMA}`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(sql: SQL): Promise<Set<string>> {
  const rows = (await sql.unsafe(`SELECT name FROM ${MIGRATIONS_TABLE}`)) as Array<{
    name: string;
  }>;
  return new Set(rows.map((row) => row.name));
}

async function applyPending(sql: SQL): Promise<void> {
  await ensureMigrationsTable(sql);
  const applied = await appliedMigrations(sql);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const ddl = readFileSync(join(migrationsDir, file), 'utf8');

    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx.unsafe(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [file]);
    });

    logger.info(`applied: ${file}`);
  }
}

// Migrations run once at startup on a dedicated client that is closed before
// the server's pool spins up — we don't leave a connection lingering in the
// process (and don't rely on GC to release it).
export async function runMigrations(): Promise<void> {
  const sql = new SQL(env.databaseUrl);
  try {
    await applyPending(sql);
  } finally {
    await sql.end();
  }
}
