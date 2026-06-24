import { defineConfig } from '@ilbertt/bun-sqlgen/config';

// Trial config for @ilbertt/bun-sqlgen. PGlite 0.5.2 is Postgres 18 (so uuidv7()
// and uuid_extract_timestamp() are native) — we only need to strip the ParadeDB
// bm25 indexes, which don't affect the result-row types we're after.
export default defineConfig({
  transformMigration: ({ sql }) =>
    sql
      // `[^;]` keeps each match within a single statement (no `;` inside a bm25 index).
      .replace(/CREATE INDEX[^;]*USING bm25[^;]*;/gi, '')
      .replace(/DROP INDEX[^;]*bm25[^;]*;/gi, ''),
});
