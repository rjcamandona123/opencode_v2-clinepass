#!/usr/bin/env bash
# setup.sh — install OpenCode V2 + this ClinePass body in one step.
#
# Usage:
#   git clone https://github.com/rjcamandona123/acode-opencode_v2-clinepass.git
#   cd acode-opencode_v2-clinepass
#   ./setup.sh
#
# After it finishes, just run:  opencode

set -euo pipefail

# 1. Install OpenCode V2 if it isn't already on PATH.
if ! command -v opencode >/dev/null 2>&1; then
  echo "==> Installing OpenCode V2..."
  curl -fsSL https://opencode.ai/install | bash
  # Make sure the installer's bin dir is on PATH for this shell.
  export PATH="$HOME/.opencode/bin:$PATH"
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: 'opencode' not found after install. Add ~/.opencode/bin to PATH and re-run." >&2
  exit 1
fi

echo "==> OpenCode: $(opencode --version)"

# 2. Copy this repository's body into ~/.config/opencode.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OC_DIR="$HOME/.config/opencode"
echo "==> Installing body into $OC_DIR"
mkdir -p "$OC_DIR/plugins/lib" "$OC_DIR/plugins/background-work"

cp -f "$SCRIPT_DIR/opencode.jsonc"   "$OC_DIR/"
cp -f "$SCRIPT_DIR/cli.json"         "$OC_DIR/"
cp -f "$SCRIPT_DIR/package.json"     "$OC_DIR/"
cp -f "$SCRIPT_DIR/package-lock.json" "$OC_DIR/"
cp -f "$SCRIPT_DIR/plugins/clinepass.ts"        "$OC_DIR/plugins/"
cp -f "$SCRIPT_DIR/plugins/clinepass.v1.ts.bak" "$OC_DIR/plugins/" 2>/dev/null || true
cp -f "$SCRIPT_DIR/plugins/lib/"*.ts            "$OC_DIR/plugins/lib/"
cp -f "$SCRIPT_DIR/plugins/background-work/"*.ts "$OC_DIR/plugins/background-work/"

# 3. Install the plugin dependency.
echo "==> npm install"
cd "$OC_DIR" && npm install --silent

echo ""
echo "==> Done. Run: opencode"
echo "    Then /connect -> ClinePass to sign in."
