#!/usr/bin/env bash
set -euo pipefail

output_path="${1:-${BUNDLE_PATH:-}}"
if [ -z "$output_path" ]; then
  echo "Usage: $0 <output-tarball>" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$(dirname "$output_path")"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

(
  cd "$repo_root/nango-integrations"
  bun run build:backend-client
)

tar cf - \
  --exclude=node_modules \
  --exclude=.nango \
  -C "$repo_root/nango-integrations" \
  . | tar xf - -C "$staging"

(
  cd "$staging"
  bun install --lockfile-only
)

cmd=(
  tar czf "$output_path"
  -C "$staging"
  .
)

printf '$'
printf ' %q' "${cmd[@]}"
printf '\n'
"${cmd[@]}"
