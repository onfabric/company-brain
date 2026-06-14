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
  -C "$repo_root"
  docker-compose.yml docker-compose.prod.yml
  db/prepare
  nango/packages/providers/providers.yaml
  -C "$repo_root/infra" caddy/Caddyfile
  -C "$repo_root/infra/deploy" on_box_deploy.sh ensure_data_volume.sh
)

printf '$'
printf ' %q' "${cmd[@]}"
printf '\n'
"${cmd[@]}"
