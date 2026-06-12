#!/bin/sh
# Creates the `keycloak` role and its dedicated database (idempotent). Keycloak
# runs its own migrations there, fully separated from the nango/brain data while
# riding the same Postgres instance, volume, and backups.
# Run by the `db-prepare` service; connection comes from PG* in the environment.
set -e

: "${KEYCLOAK_DB_USER:?}" "${KEYCLOAK_DB_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 \
  -v kc_user="$KEYCLOAK_DB_USER" -v kc_pass="$KEYCLOAK_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'kc_user', :'kc_pass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'kc_user')\gexec

SELECT format('CREATE DATABASE keycloak OWNER %I', :'kc_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
SQL
