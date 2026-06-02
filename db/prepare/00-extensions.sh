#!/bin/sh
# Enables the Postgres extensions the stack needs, idempotently. Unlike the
# initdb scripts (which only run on a brand-new data dir), the `db-prepare`
# service runs this on every `up`, so an already-initialized database that
# predates an extension still gets it. `brain` depends on db-prepare completing,
# so its migrations (e.g. the bm25 index from pg_search) always find them.
# Run as the Postgres superuser; connection comes from PG* in the environment.
set -e

psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_search;
SQL
