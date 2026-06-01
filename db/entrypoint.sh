#!/usr/bin/env bash
# Custom entrypoint for the Postgres (ParadeDB) container.
# Delegates to the image's docker-entrypoint.sh so initdb + the scripts in
# /docker-entrypoint-initdb.d/ still run on a fresh data dir, while pinning the
# server flags we need.
#
# shared_preload_libraries must list BOTH pg_cron and pg_search: passing -c here
# overrides ParadeDB's default (which preloads pg_search), and pg_search refuses
# to be created unless preloaded, so the bm25 access method would never register.

set -e

exec docker-entrypoint.sh postgres \
  -c shared_preload_libraries=pg_cron,pg_search \
  -c cron.database_name="${NANGO_DB_NAME}"
