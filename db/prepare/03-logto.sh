#!/bin/sh
# Creates the `logto` role and its dedicated database (idempotent). Logto seeds
# and migrates its own schema there on startup (`logto db seed`).
# Run by the `db-prepare` service; connection comes from PG* in the environment.
set -e

: "${LOGTO_DB_USER:?}" "${LOGTO_DB_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 \
  -v logto_user="$LOGTO_DB_USER" -v logto_pass="$LOGTO_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'logto_user', :'logto_pass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'logto_user')\gexec

SELECT format('CREATE DATABASE logto OWNER %I', :'logto_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'logto')\gexec
SQL
