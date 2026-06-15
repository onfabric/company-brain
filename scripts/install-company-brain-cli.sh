#!/usr/bin/env bash
set -euo pipefail

BIN_NAME="company-brain"
DEFAULT_REPO_DIR="$HOME/Library/Application Support/company-brain/repo"
INSTALL_DIR="${COMPANY_BRAIN_CLI_INSTALL_DIR:-"$HOME/.local/bin"}"
REPO_DIR="${COMPANY_BRAIN_CLI_REPO_DIR:-}"
REPO_REF="${COMPANY_BRAIN_CLI_REPO_REF:-}"
REPO_URL="${COMPANY_BRAIN_CLI_REPO_URL:-https://github.com/onfabric/company-brain.git}"

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

is_company_brain_repo() {
  local candidate="$1"
  [[ -f "$candidate/package.json" && -f "$candidate/cli/src/main.ts" ]]
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script_repo_dir="$(cd "$script_dir/.." && pwd)"

say "Company Brain CLI installer"
say "Checking prerequisites..."
require_command bun

if [[ -z "$REPO_DIR" ]]; then
  if is_company_brain_repo "$script_repo_dir"; then
    REPO_DIR="$script_repo_dir"
  else
    REPO_DIR="$DEFAULT_REPO_DIR"
  fi
fi

if [[ ! -d "$REPO_DIR" ]]; then
  require_command git
  say "Cloning Company Brain into $REPO_DIR..."
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone --recurse-submodules "$REPO_URL" "$REPO_DIR"
elif ! is_company_brain_repo "$REPO_DIR"; then
  fail "$REPO_DIR does not look like a Company Brain checkout"
fi

say "Preparing checkout at $REPO_DIR..."
if [[ -d "$REPO_DIR/.git" ]]; then
  require_command git
  (
    cd "$REPO_DIR"
    if [[ -n "$REPO_REF" ]]; then
      say "Checking out $REPO_REF..."
      git fetch --tags origin
      git checkout "$REPO_REF"
    fi
    git submodule update --init --recursive
  )
fi

say "Installing Bun dependencies..."
(
  cd "$REPO_DIR"
  bun install
)

say "Installing $BIN_NAME into $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
bin_path="$INSTALL_DIR/$BIN_NAME"
{
  printf '%s\n' '#!/usr/bin/env bash'
  printf '%s\n' 'set -euo pipefail'
  printf 'COMPANY_BRAIN_REPO_DIR=%q\n' "$REPO_DIR"
  printf '%s\n' 'exec bun "$COMPANY_BRAIN_REPO_DIR/cli/src/main.ts" "$@"'
} > "$bin_path"
chmod 0755 "$bin_path"

say "Installed $BIN_NAME at $bin_path"
if command -v "$BIN_NAME" >/dev/null 2>&1; then
  say "Run: $BIN_NAME --help"
else
  say "Add $INSTALL_DIR to PATH, then run: $BIN_NAME --help"
  say "You can also run it directly: $bin_path --help"
fi
say "Next: $BIN_NAME local setup or $BIN_NAME cloud setup"
