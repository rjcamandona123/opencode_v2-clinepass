#!/usr/bin/env bash
# setup.sh — install OpenCode V2 (binary bundled in this repo's Release) + body.
#
# Usage:
#   git clone https://github.com/rjcamandona123/acode-opencode_v2-clinepass.git
#   cd acode-opencode_v2-clinepass
#   ./setup.sh
#
# After it finishes, just run:  opencode

set -euo pipefail

REPO="rjcamandona123/acode-opencode_v2-clinepass"
TAG="v2.2.5"
BIN_URL="https://github.com/${REPO}/releases/download/${TAG}/opencode"
BIN_DIR="$HOME/.opencode/bin"
BIN_PATH="$BIN_DIR/opencode"

# 1. Install the OpenCode V2 binary if it isn't already on PATH.
if ! command -v opencode >/dev/null 2>&1; then
  echo "==> Downloading OpenCode V2 binary from this repo's Release..."
  mkdir -p "$BIN_DIR"
  curl -fL --http2 --tcp-fastopen -C - --retry 5 --retry-delay 2 --connect-timeout 30 --progress-bar -o "$BIN_PATH" "$BIN_URL"
  chmod +x "$BIN_PATH"
  export PATH="$BIN_DIR:$PATH"
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: 'opencode' not found. Add $BIN_DIR to PATH and re-run." >&2
  exit 1
fi

echo "==> OpenCode: $(opencode --version)"

# 2. Copy this repository's body into ~/.config/opencode.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OC_DIR="$HOME/.config/opencode"
echo "==> Installing body into $OC_DIR"
mkdir -p "$OC_DIR/plugins/lib" "$OC_DIR/plugins/background-work"

cp -f "$SCRIPT_DIR/opencode.jsonc"    "$OC_DIR/"
cp -f "$SCRIPT_DIR/cli.json"          "$OC_DIR/"
cp -f "$SCRIPT_DIR/package.json"      "$OC_DIR/"
cp -f "$SCRIPT_DIR/package-lock.json" "$OC_DIR/"
cp -f "$SCRIPT_DIR/plugins/clinepass.ts"         "$OC_DIR/plugins/"
cp -f "$SCRIPT_DIR/plugins/clinepass.v1.ts.bak"  "$OC_DIR/plugins/" 2>/dev/null || true
cp -f "$SCRIPT_DIR/plugins/lib/"*.ts             "$OC_DIR/plugins/lib/"
cp -f "$SCRIPT_DIR/plugins/background-work/"*.ts "$OC_DIR/plugins/background-work/"

# 3. Install the plugin dependency.
echo "==> npm install"
cd "$OC_DIR" && npm install --silent

echo ""
echo "==> Done. Run: opencode"
echo "    Then /connect -> ClinePass to sign in."
