# backend (brain)

Bun + Elysia service. See [README](README.md) for run/build; root [`AGENTS.md`](../AGENTS.md) for code style and validation. This file is the conventions to keep when changing the code.

## Layering (keep strict)

- `src/routes/<path>/` — `controller.ts` (Elysia routes) + `model.ts` (TypeBox schemas). Wire each controller into `src/app.ts` with `.use()`. The folder tree mirrors the HTTP path so the layout maps directly to the URL: `GET /health` → `src/routes/health/`, `POST /webhooks/batch-save` → `src/routes/webhooks/batch-save/`.
- `src/services/` — business logic, one service per concern, extends `Service` (gives `this.logger`). No SQL here.
- `src/repositories/` — all SQL, one repository per concern, extends `Repository` (holds the `Bun.sql` client). No business logic here.
- Controllers call services; services call repositories. Build the graph once in `src/services/plugins.ts` and expose each via an Elysia `.decorate` plugin.
- `#*` imports map to `./src/*`.

## Database

- Raw SQL via `Bun.sql` (`src/db/client.ts`), no ORM. Always schema-qualify (`brain.*`, `nango_records.*`).
- The service connects as the least-privilege `brain` role: it owns `brain` and may read + FK-reference `nango_records`, but cannot touch the `nango` schema and must not write to `nango_records`.
- Migrations: ordered `src/db/migrations/NNNN_*.sql`, applied on startup by `src/db/migrate.ts` on a dedicated client that is closed before the server starts. App DDL goes in a migration file; the runner's own ledger lives in the `backend_migrations` schema — never put app tables there. Add a migration by dropping in the next-numbered `.sql`.
- Row types: every table you add in a migration gets a matching row type in `src/db/tables.ts`. Type every SQL query result from that type — never re-declare column types inline. For partial selects, derive from it (`Pick<Foo, 'id' | 'name'>`, or `Foo['id']` for a single column), so the row type stays the one source of truth.
- Foreign-key columns are typed as the referenced table's id (`data_source_id: DataSources['id']`), never a bare `string`, so the FK stays tied to its target's id type.
