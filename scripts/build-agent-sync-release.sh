#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-"$ROOT_DIR/dist/agent-sync-release"}"
BIN_NAME="company-brain-agent-sync"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

build_asset() {
  local target="$1"
  local platform="$2"
  local asset="$BIN_NAME-$platform.tar.gz"
  local package_dir="$OUT_DIR/package-$platform"

  mkdir -p "$package_dir"
  bun build \
    --compile \
    --target="$target" \
    --outfile="$package_dir/$BIN_NAME" \
    "$ROOT_DIR/agent-sync/src/cli.ts"
  chmod 0755 "$package_dir/$BIN_NAME"
  tar -C "$package_dir" -czf "$OUT_DIR/$asset" "$BIN_NAME"
  rm -rf "$package_dir"

  (
    cd "$OUT_DIR"
    shasum -a 256 "$asset" > "$asset.sha256"
  )
}

build_asset bun-darwin-arm64 darwin-arm64
build_asset bun-darwin-x64 darwin-x64

cp "$ROOT_DIR/scripts/install-agent-sync.sh" "$OUT_DIR/install.sh"
chmod 0755 "$OUT_DIR/install.sh"

(
  cd "$OUT_DIR"
  shasum -a 256 "$BIN_NAME"-darwin-*.tar.gz install.sh > checksums.txt
)
