-- Runs once on first Postgres init (empty data dir).
-- Enables the extensions we want available in the `nango` database.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_search;
CREATE EXTENSION IF NOT EXISTS pg_cron;
