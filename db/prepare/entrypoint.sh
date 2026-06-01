#!/bin/sh
# Entrypoint for the `db-prepare` service: runs the numbered bootstrap scripts in
# this directory, in order, as the Postgres superuser. Numbered (`NN-*.sh`)
# scripts run; this file is skipped, so it can live alongside them.
set -e

dir="$(dirname "$0")"
for f in "$dir"/[0-9]*.sh; do
  echo "[db-prepare] running $f"
  sh "$f"
done
