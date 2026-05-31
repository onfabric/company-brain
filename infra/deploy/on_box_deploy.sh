#!/bin/bash
# Runs ON the EC2 instance, invoked by the deploy workflow via SSM. Reads its
# non-secret config from the environment (IMAGE_URI, SSM_SECRET_PREFIX,
# NANGO_HOSTNAME, NANGO_CONNECT_HOSTNAME, DOZZLE_HOSTNAME, ACME_EMAIL,
# AWS_DEFAULT_REGION), exported by the SSM command.
set -euo pipefail

cd "$(dirname "$0")"

: "${IMAGE_URI:?}" "${SSM_SECRET_PREFIX:?}" "${NANGO_HOSTNAME:?}" "${NANGO_CONNECT_HOSTNAME:?}" "${DOZZLE_HOSTNAME:?}" "${ACME_EMAIL:?}" "${AWS_DEFAULT_REGION:?}"

secret() {
  aws ssm get-parameter --name "${SSM_SECRET_PREFIX}/$1" --with-decryption \
    --query Parameter.Value --output text
}

NANGO_ENCRYPTION_KEY="$(secret nango_encryption_key)"
NANGO_DB_PASSWORD="$(secret nango_db_password)"
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
NANGO_ENCRYPTION_KEY=${NANGO_ENCRYPTION_KEY}
NANGO_DB_USER=nango
NANGO_DB_PASSWORD=${NANGO_DB_PASSWORD}
NANGO_DB_NAME=nango
NANGO_DB_SCHEMA=nango
NANGO_SERVER_PORT=3003
NANGO_CONNECT_UI_PORT=3009
NANGO_SERVER_URL=https://${NANGO_HOSTNAME}
NANGO_PUBLIC_SERVER_URL=https://${NANGO_HOSTNAME}
NANGO_PUBLIC_CONNECT_URL=https://${NANGO_CONNECT_HOSTNAME}
REDIS_PORT=6379
ELASTICSEARCH_PORT=9200
DOZZLE_PORT=8080
FLAG_AUTH_ENABLED=true
NANGO_DASHBOARD_USERNAME=${NANGO_DASHBOARD_USERNAME}
NANGO_DASHBOARD_PASSWORD=${NANGO_DASHBOARD_PASSWORD}
LOG_LEVEL=info
IMAGE_URI=${IMAGE_URI}
NANGO_HOSTNAME=${NANGO_HOSTNAME}
NANGO_CONNECT_HOSTNAME=${NANGO_CONNECT_HOSTNAME}
DOZZLE_HOSTNAME=${DOZZLE_HOSTNAME}
ACME_EMAIL=${ACME_EMAIL}
EOF

# Authenticate Docker to ECR.
registry="${IMAGE_URI%%/*}"
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry"

compose="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$compose pull
$compose up -d --remove-orphans
docker image prune -f
