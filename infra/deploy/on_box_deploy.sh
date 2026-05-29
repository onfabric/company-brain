#!/bin/bash
# Runs ON the EC2 instance, invoked by the deploy workflow via SSM.
# Expects to run from the extracted bundle directory, alongside deploy.env.
set -euo pipefail

cd "$(dirname "$0")"
# Non-secret deploy config written by CI (region, ssm prefix, hostname, image).
source ./deploy.env
export AWS_DEFAULT_REGION

secret() {
  aws ssm get-parameter --name "${SSM_SECRET_PREFIX}/$1" --with-decryption \
    --query Parameter.Value --output text
}

# Render .env consumed by docker compose. Secrets come from SSM; the rest is
# fixed prod config.
umask 077
cat > .env <<EOF
NANGO_ENCRYPTION_KEY=$(secret nango_encryption_key)
NANGO_DB_USER=nango
NANGO_DB_PASSWORD=$(secret nango_db_password)
NANGO_DB_NAME=nango
NANGO_DB_SCHEMA=nango
NANGO_SERVER_PORT=3003
NANGO_CONNECT_UI_PORT=3009
NANGO_SERVER_URL=https://${NANGO_HOSTNAME}
NANGO_PUBLIC_SERVER_URL=https://${NANGO_HOSTNAME}
REDIS_PORT=6379
ELASTICSEARCH_PORT=9200
DOZZLE_PORT=8080
FLAG_AUTH_ENABLED=true
NANGO_ENTERPRISE=false
NANGO_DASHBOARD_USERNAME=$(secret nango_dashboard_username)
NANGO_DASHBOARD_PASSWORD=$(secret nango_dashboard_password)
LOG_LEVEL=info
IMAGE_URI=${IMAGE_URI}
NANGO_HOSTNAME=${NANGO_HOSTNAME}
ACME_EMAIL=${ACME_EMAIL}
EOF

# Authenticate Docker to ECR.
registry="${IMAGE_URI%%/*}"
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry"

compose="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$compose pull
$compose up -d --remove-orphans
docker image prune -f
