#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_NAME="company-brain-agent-sync"
TMP_ROOT="$(mktemp -d)"

cleanup() {
  if [[ "${COMPANY_BRAIN_AGENT_SYNC_SMOKE_KEEP:-}" == "1" ]]; then
    echo "Kept smoke test directory: $TMP_ROOT"
  else
    rm -rf "$TMP_ROOT"
  fi
}
trap cleanup EXIT

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "agent-sync installer smoke test currently supports macOS only." >&2
  exit 1
fi

if ! command -v script >/dev/null 2>&1; then
  echo "agent-sync installer smoke test requires script." >&2
  exit 1
fi

release_dir="$TMP_ROOT/release"
home_dir="$TMP_ROOT/home"
install_script="$release_dir/install.sh"
release_url="file://$release_dir"

mkdir -p "$home_dir"
"$ROOT_DIR/scripts/build-agent-sync-release.sh" "$release_dir"

script -q /dev/null \
  env \
  "HOME=$home_dir" \
  "COMPANY_BRAIN_AGENT_SYNC_RELEASE_URL=$release_url" \
  "COMPANY_BRAIN_AGENT_SYNC_SKIP_DAEMON=1" \
  "COMPANY_BRAIN_AGENT_SYNC_CONFIGURE_MISSING_ONLY=1" \
  "COMPANY_BRAIN_NANGO_WEBHOOK_URL=https://nango.test/webhook/env/agent-conversations" \
  "COMPANY_BRAIN_NANGO_CONNECTION_ID=local-agent-sync" \
  "COMPANY_BRAIN_NANGO_WEBHOOK_SECRET=shared-secret" \
  bash "$install_script"

installed_bin="$home_dir/Library/Application Support/company-brain/agent-sync/$BIN_NAME"
if [[ ! -x "$installed_bin" ]]; then
  echo "Expected installed binary at $installed_bin" >&2
  exit 1
fi

status_json="$TMP_ROOT/status.json"
HOME="$home_dir" \
  COMPANY_BRAIN_NANGO_WEBHOOK_URL="https://nango.test/webhook/env/agent-conversations" \
  COMPANY_BRAIN_NANGO_CONNECTION_ID="local-agent-sync" \
  COMPANY_BRAIN_NANGO_WEBHOOK_SECRET="shared-secret" \
  "$installed_bin" status --json > "$status_json"
STATUS_JSON="$status_json" bun -e "const status = await Bun.file(process.env.STATUS_JSON).json(); if (status.missing_config.length > 0) { console.error(JSON.stringify(status, null, 2)); process.exit(1); }"

echo "agent-sync installer smoke test passed."
