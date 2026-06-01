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
fake_release_dir="$TMP_ROOT/fake-release"
fake_package_dir="$TMP_ROOT/fake-package"
fake_home_dir="$TMP_ROOT/fake-home"

case "$(uname -m)" in
  arm64) platform="darwin-arm64" ;;
  x86_64) platform="darwin-x64" ;;
  *)
    echo "Unsupported macOS architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

mkdir -p "$home_dir"
"$ROOT_DIR/scripts/build-agent-sync-release.sh" "$release_dir"

script -q /dev/null \
  env \
  "HOME=$home_dir" \
  "COMPANY_BRAIN_AGENT_SYNC_RELEASE_URL=$release_url" \
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
  "$installed_bin" init --missing-only --skip-daemon

HOME="$home_dir" \
  "$installed_bin" status --json > "$status_json"
STATUS_JSON="$status_json" bun -e "const status = await Bun.file(process.env.STATUS_JSON).json(); if (status.missing_config.length > 0) { console.error(JSON.stringify(status, null, 2)); process.exit(1); }"

mkdir -p "$fake_release_dir" "$fake_package_dir" "$fake_home_dir"
cp "$install_script" "$fake_release_dir/install.sh"
cat > "$fake_package_dir/$BIN_NAME" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$HOME/agent-sync-args.log"
case "${1:-}" in
  status)
    printf '{"missing_config":[]}\n'
    ;;
esac
EOF
chmod 0755 "$fake_package_dir/$BIN_NAME"
asset="$BIN_NAME-$platform.tar.gz"
tar -C "$fake_package_dir" -czf "$fake_release_dir/$asset" "$BIN_NAME"
(
  cd "$fake_release_dir"
  shasum -a 256 "$asset" > "$asset.sha256"
)

script -q /dev/null \
  env \
  "HOME=$fake_home_dir" \
  "COMPANY_BRAIN_AGENT_SYNC_RELEASE_URL=file://$fake_release_dir" \
  bash "$fake_release_dir/install.sh"

if [[ -e "$fake_home_dir/agent-sync-args.log" ]]; then
  echo "Expected installer to install the CLI without running configuration commands." >&2
  cat "$fake_home_dir/agent-sync-args.log" >&2
  exit 1
fi

echo "agent-sync installer smoke test passed."
