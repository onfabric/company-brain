#!/bin/sh
# Creates the least-privilege `brain` role (idempotent): it owns its own `brain`
# schema and can read (SELECT) and reference (FOREIGN KEY) Nango's synced
# records, but never the `nango` schema where credentials live.
# Run by the `db-prepare` service; connection comes from PG* in the environment.
set -e

: "${BRAIN_DB_USER:?}" "${BRAIN_DB_PASSWORD:?}" "${NANGO_DB_NAME:?}" "${NANGO_RECORDS_DATABASE_SCHEMA:?}"

# Connection comes from PGHOST/PGUSER/PGPASSWORD in the environment. Connect to
# the maintenance database first so older local volumes can be upgraded when the
# target application database does not exist yet.
psql -v ON_ERROR_STOP=1 \
  -v owner="$PGUSER" -v dbname="$NANGO_DB_NAME" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'dbname', :'owner')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'dbname')\gexec
SQL

# Connect to the target application database for role, schema, and grants.
#
# We pre-create the schema Nango stores synced records in so the grants can be
# set even before Nango has migrated; Nango later creates it with
# `CREATE SCHEMA IF NOT EXISTS`, so this is a no-op for it. The default-privileges
# grant then covers the record tables Nango adds afterwards.
psql -d "$NANGO_DB_NAME" -v ON_ERROR_STOP=1 \
  -v brain_user="$BRAIN_DB_USER" -v brain_pass="$BRAIN_DB_PASSWORD" \
  -v owner="$PGUSER" -v dbname="$NANGO_DB_NAME" -v records="$NANGO_RECORDS_DATABASE_SCHEMA" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'brain_user', :'brain_pass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'brain_user')\gexec

CREATE EXTENSION IF NOT EXISTS pg_search;

-- Lets the brain service create (and thereby own) its `brain` schema in its
-- first migration.
GRANT CREATE ON DATABASE :"dbname" TO :"brain_user";

CREATE SCHEMA IF NOT EXISTS :"records" AUTHORIZATION :"owner";
GRANT USAGE ON SCHEMA :"records" TO :"brain_user";
GRANT SELECT, REFERENCES ON ALL TABLES IN SCHEMA :"records" TO :"brain_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA :"records"
  GRANT SELECT, REFERENCES ON TABLES TO :"brain_user";

GRANT USAGE ON SCHEMA paradedb TO :"brain_user";
SQL
