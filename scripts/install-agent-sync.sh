#!/usr/bin/env bash
set -euo pipefail

REPO="${COMPANY_BRAIN_AGENT_SYNC_REPO:-onfabric/company-brain}"
VERSION="${COMPANY_BRAIN_AGENT_SYNC_VERSION:-latest}"
INSTALL_DIR="${COMPANY_BRAIN_AGENT_SYNC_INSTALL_DIR:-"$HOME/Library/Application Support/company-brain/agent-sync"}"
BIN_NAME="company-brain-agent-sync"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "agent-sync currently supports macOS only." >&2
  exit 1
fi

case "$(uname -m)" in
  arm64) platform="darwin-arm64" ;;
  x86_64) platform="darwin-x64" ;;
  *)
    echo "Unsupported macOS architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

asset="$BIN_NAME-$platform.tar.gz"
if [[ -n "${COMPANY_BRAIN_AGENT_SYNC_RELEASE_URL:-}" ]]; then
  release_url="${COMPANY_BRAIN_AGENT_SYNC_RELEASE_URL%/}"
elif [[ "$VERSION" == "latest" ]]; then
  release_url="https://github.com/$REPO/releases/latest/download"
else
  release_url="https://github.com/$REPO/releases/download/$VERSION"
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

curl_args=(-fsSL --retry 3)
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  curl_args+=(-H "Authorization: Bearer $GITHUB_TOKEN")
fi

echo "Downloading $asset from $release_url..."
curl "${curl_args[@]}" "$release_url/$asset" -o "$tmp_dir/$asset"
curl "${curl_args[@]}" "$release_url/$asset.sha256" -o "$tmp_dir/$asset.sha256"

(
  cd "$tmp_dir"
  shasum -a 256 -c "$asset.sha256"
  tar -xzf "$asset"
)

mkdir -p "$INSTALL_DIR"
install -m 0755 "$tmp_dir/$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"

mkdir -p "$HOME/.local/bin"
ln -sfn "$INSTALL_DIR/$BIN_NAME" "$HOME/.local/bin/$BIN_NAME"

echo "Installed $BIN_NAME to $INSTALL_DIR/$BIN_NAME"

echo "agent-sync CLI is installed."
echo "Run '$HOME/.local/bin/$BIN_NAME init' to configure it and install the macOS LaunchAgent."
echo "If ~/.local/bin is not on PATH, run '$INSTALL_DIR/$BIN_NAME init'."
echo "Logs: $HOME/.company-brain/agent-sync/logs"
