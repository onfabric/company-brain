# backend — Data Transformation Service ("brain")

Bun + Elysia service that owns the `brain` Postgres schema in the same database
Nango uses. It runs ordered SQL migrations on startup (before accepting
traffic), then serves the HTTP API. Follows the service/repository pattern.

## Develop

```sh
cp .env.example .env   # point DATABASE_URL at a running Postgres
bun run start
bun test
bun run check:types
```

## Build

`bun run build` compiles a standalone binary to `dist/server` and copies the
SQL migrations next to it. The `backend/Dockerfile` (built from the monorepo
root) ships that binary on a distroless image.

See [`AGENTS.md`](AGENTS.md) for the code layout and conventions.
