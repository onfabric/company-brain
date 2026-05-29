#!/usr/bin/env bash
# Custom entrypoint for the Postgres (ParadeDB) container.
# Delegates to the image's docker-entrypoint.sh so initdb + the scripts in
# /docker-entrypoint-initdb.d/ still run on a fresh data dir, while adding
# the flags we need for pg_cron.

set -e

exec docker-entrypoint.sh postgres \
  -c shared_preload_libraries=pg_cron \
  -c cron.database_name="${NANGO_DB_NAME}"
