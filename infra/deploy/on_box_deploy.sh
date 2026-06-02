#!/bin/bash
# Runs ON the EC2 instance, invoked by the deploy workflow via SSM. Reads its
# non-secret config from the environment (NANGO_IMAGE_URI, BRAIN_IMAGE_URI, SSM_SECRET_PREFIX,
# NANGO_HOSTNAME, NANGO_CONNECT_HOSTNAME, DOZZLE_HOSTNAME, ACME_EMAIL,
# AWS_DEFAULT_REGION), exported by the SSM command.
set -euo pipefail

cd "$(dirname "$0")"

log() { echo "=== [on_box_deploy $(date -u +%H:%M:%S)] $* ==="; }

: "${NANGO_IMAGE_URI:?}" "${BRAIN_IMAGE_URI:?}" "${SSM_SECRET_PREFIX:?}" "${NANGO_HOSTNAME:?}" "${NANGO_CONNECT_HOSTNAME:?}" "${DOZZLE_HOSTNAME:?}" "${ACME_EMAIL:?}" "${AWS_DEFAULT_REGION:?}"

secret() {
  aws ssm get-parameter --name "${SSM_SECRET_PREFIX}/$1" --with-decryption \
    --query Parameter.Value --output text
}

NANGO_DB_PASSWORD="$(secret nango_db_password)"
BRAIN_DB_PASSWORD="$(secret brain_db_password)"
NANGO_DASHBOARD_USERNAME="$(secret nango_dashboard_username)"
NANGO_DASHBOARD_PASSWORD="$(secret nango_dashboard_password)"

# Dozzle simple-auth users file (full users.yml, generated via `dozzle generate`),
# mounted into the container at /data/users.yml by the prod compose override.
umask 077
mkdir -p dozzle/data
secret dozzle_users > dozzle/data/users.yml

# Render .env consumed by docker compose. Secrets come from SSM; the rest is
# fixed prod config.
cat > .env <<EOF
# Encryption intentionally disabled so the brain can read nango_records as
# plaintext over SQL. Leave empty; do not wire a key back in.
NANGO_ENCRYPTION_KEY=
NANGO_DB_USER=nango
NANGO_DB_PASSWORD=${NANGO_DB_PASSWORD}
NANGO_DB_NAME=nango
NANGO_DB_SCHEMA=nango
NANGO_RECORDS_DATABASE_SCHEMA=nango_records
BRAIN_DB_USER=brain
BRAIN_DB_PASSWORD=${BRAIN_DB_PASSWORD}
NANGO_SERVER_PORT=3003
NANGO_CONNECT_UI_PORT=3009
NANGO_SERVER_URL=https://${NANGO_HOSTNAME}
NANGO_PUBLIC_SERVER_URL=https://${NANGO_HOSTNAME}
NANGO_PUBLIC_CONNECT_URL=https://${NANGO_CONNECT_HOSTNAME}
REDIS_PORT=6379
ELASTICSEARCH_PORT=9200
DOZZLE_PORT=8080
BRAIN_SERVER_PORT=3010
FLAG_AUTH_ENABLED=true
NANGO_DASHBOARD_USERNAME=${NANGO_DASHBOARD_USERNAME}
NANGO_DASHBOARD_PASSWORD=${NANGO_DASHBOARD_PASSWORD}
LOG_LEVEL=info
NANGO_IMAGE_URI=${NANGO_IMAGE_URI}
BRAIN_IMAGE_URI=${BRAIN_IMAGE_URI}
NANGO_HOSTNAME=${NANGO_HOSTNAME}
NANGO_CONNECT_HOSTNAME=${NANGO_CONNECT_HOSTNAME}
DOZZLE_HOSTNAME=${DOZZLE_HOSTNAME}
ACME_EMAIL=${ACME_EMAIL}
EOF

# Authenticate Docker to ECR. Both images share one registry host, so a single
# login covers them.
registry="${NANGO_IMAGE_URI%%/*}"
log "Authenticating Docker to ECR (${registry})"
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry"

compose="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

log "Pulling images"
$compose pull

log "Starting services (up -d --remove-orphans)"
$compose up -d --remove-orphans

log "Pruning dangling images"
docker image prune -f

# Gate the deploy on container health: every long-running service must report a
# `healthy` healthcheck, and one-shot services (db-prepare) must have exited 0.
# Poll until that holds or we time out, then fail so CI/SSM surfaces a bad deploy
# instead of reporting success while a container is unhealthy or crash-looping.
# Parsed with pure shell (the box has no jq).
log "Waiting for all containers to become healthy"
deadline=$((SECONDS + 360))
while :; do
  unhealthy=""
  while IFS='|' read -r name state health exitcode; do
    [ -z "$name" ] && continue
    if [ -n "$health" ]; then
      [ "$health" = "healthy" ] || unhealthy="${unhealthy}${name}: health=${health}\n"
    elif [ "$state" = "exited" ]; then
      [ "${exitcode:-0}" = "0" ] || unhealthy="${unhealthy}${name}: exited(${exitcode})\n"
    elif [ "$state" != "running" ]; then
      unhealthy="${unhealthy}${name}: state=${state}\n"
    fi
  done <<EOF
$($compose ps -a --format '{{.Name}}|{{.State}}|{{.Health}}|{{.ExitCode}}')
EOF
  [ -z "$unhealthy" ] && { log "All containers healthy"; break; }
  if [ "$SECONDS" -ge "$deadline" ]; then
    log "Containers not healthy after timeout:"
    printf '%b' "$unhealthy"
    $compose ps -a --format 'table {{.Name}}\t{{.Status}}'
    exit 1
  fi
  sleep 5
done

log "Compose service status"
$compose ps -a --format 'table {{.Name}}\t{{.Status}}'

log "Image versions"
$compose images

log "Deploy finished"
