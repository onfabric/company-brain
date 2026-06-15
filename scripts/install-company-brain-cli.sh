#!/usr/bin/env bash
set -euo pipefail

BIN_NAME="company-brain"
INSTALL_DIR="${COMPANY_BRAIN_CLI_INSTALL_DIR:-"$HOME/.local/bin"}"
RELEASE_VERSION="${COMPANY_BRAIN_CLI_VERSION:-latest}"
RELEASE_BASE_URL="${COMPANY_BRAIN_CLI_RELEASE_BASE_URL:-https://github.com/onfabric/company-brain/releases}"
RELEASES_API_URL="${COMPANY_BRAIN_CLI_RELEASES_API_URL:-https://api.github.com/repos/onfabric/company-brain/releases?per_page=100}"
RELEASE_MANIFEST_ASSET="company-brain-release.json"

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    return
  fi

  say "Installing Bun for packaged Nango integration commands..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${BUN_INSTALL:-"$HOME/.bun"}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun >/dev/null 2>&1; then
    fail "Bun installation finished, but bun is not on PATH"
  fi
}

asset_platform() {
  case "$(uname -s)" in
    Darwin) printf 'darwin' ;;
    Linux) printf 'linux' ;;
    *) fail "Unsupported OS: $(uname -s)" ;;
  esac
}

asset_arch() {
  case "$(uname -m)" in
    arm64|aarch64) printf 'arm64' ;;
    x86_64|amd64) printf 'x64' ;;
    *) fail "Unsupported architecture: $(uname -m)" ;;
  esac
}

download_url() {
  local asset="$1"
  printf '%s/download/%s/%s' "$RELEASE_BASE_URL" "$resolved_release_version" "$asset"
}

resolve_release_version() {
  if [ "$RELEASE_VERSION" != "latest" ]; then
    printf '%s\n' "$RELEASE_VERSION"
    return
  fi

  COMPANY_BRAIN_CLI_RELEASES_API_URL="$RELEASES_API_URL" \
  COMPANY_BRAIN_CLI_RELEASE_MANIFEST_ASSET="$RELEASE_MANIFEST_ASSET" \
    bun --eval '
      const apiUrl = Bun.env.COMPANY_BRAIN_CLI_RELEASES_API_URL;
      const manifestAsset = Bun.env.COMPANY_BRAIN_CLI_RELEASE_MANIFEST_ASSET;
      const response = await fetch(apiUrl, {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "company-brain-installer",
        },
      });
      if (!response.ok) {
        throw new Error(`Could not resolve latest Company Brain release: ${response.status}`);
      }

      const releases = await response.json();
      const release = releases.find((candidate) =>
        !candidate.draft &&
        !candidate.prerelease &&
        candidate.assets?.some((asset) => asset.name === manifestAsset)
      );
      if (!release?.tag_name) {
        throw new Error(`Could not find a Company Brain release containing ${manifestAsset}`);
      }

      console.log(release.tag_name);
    '
}

say "Company Brain CLI installer"
say "Checking prerequisites..."
require_command curl
if command -v shasum >/dev/null 2>&1; then
  checksum_cmd=(shasum -a 256)
elif command -v sha256sum >/dev/null 2>&1; then
  checksum_cmd=(sha256sum)
else
  fail "Missing required command: shasum or sha256sum"
fi
ensure_bun

platform="$(asset_platform)"
arch="$(asset_arch)"
asset="${BIN_NAME}-${platform}-${arch}"
resolved_release_version="$(resolve_release_version)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

say "Downloading $asset from $resolved_release_version..."
curl -fsSL "$(download_url "$asset")" -o "$tmp_dir/$asset"
curl -fsSL "$(download_url SHA256SUMS)" -o "$tmp_dir/SHA256SUMS"

expected="$(awk -v file="$asset" '$2 == "dist/" file || $2 == file { print $1 }' "$tmp_dir/SHA256SUMS" | head -1)"
if [ -z "$expected" ]; then
  fail "No checksum found for $asset"
fi
actual="$("${checksum_cmd[@]}" "$tmp_dir/$asset" | awk '{print $1}')"
if [ "$expected" != "$actual" ]; then
  fail "Checksum mismatch for $asset"
fi

say "Installing $BIN_NAME into $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
install -m 0755 "$tmp_dir/$asset" "$INSTALL_DIR/$BIN_NAME"

say "Installed $BIN_NAME at $INSTALL_DIR/$BIN_NAME"
if command -v "$BIN_NAME" >/dev/null 2>&1; then
  say "Run: $BIN_NAME --help"
else
  say "Add $INSTALL_DIR to PATH, then run: $BIN_NAME --help"
  say "You can also run it directly: $INSTALL_DIR/$BIN_NAME --help"
fi
say "Next: $BIN_NAME target"
