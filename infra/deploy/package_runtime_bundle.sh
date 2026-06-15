#!/usr/bin/env bash
set -euo pipefail

output_path="${1:-${BUNDLE_PATH:-}}"
if [ -z "$output_path" ]; then
  echo "Usage: $0 <output-tarball>" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$(dirname "$output_path")"

cmd=(
  tar czf "$output_path"
  --exclude=infra/terraform/.terraform
  --exclude=infra/terraform/*.tfplan
  --exclude=infra/terraform/*.auto.tfvars.json
  -C "$repo_root"
  .env.example docker-compose.yml docker-compose.prod.yml
  db/prepare
  nango-integrations/.env.example
  infra/terraform
  infra/deploy/on_box_deploy.sh infra/deploy/ensure_data_volume.sh infra/deploy/ssm_deploy.sh infra/deploy/package_runtime_bundle.sh
  -C "$repo_root/infra" caddy/Caddyfile
  -C "$repo_root/infra/deploy" on_box_deploy.sh ensure_data_volume.sh ssm_deploy.sh package_runtime_bundle.sh
)

printf '$'
printf ' %q' "${cmd[@]}"
printf '\n'
"${cmd[@]}"
