#!/usr/bin/env bash
# Publishes the extension to both registries.
#
# Tokens live in ~/.config/execai/: vsce.pat (Visual Studio Marketplace),
# ovsx.pat (Open VSX). They are read here, inside the script, so they never
# appear on a command line or in shell history.
#
#   scripts/publish-marketplaces.sh            # both registries
#   scripts/publish-marketplaces.sh --ms-only
#   scripts/publish-marketplaces.sh --ovsx-only

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

MS=1; OVSX=1
case "${1:-}" in
  --ms-only)   OVSX=0 ;;
  --ovsx-only) MS=0 ;;
esac

VERSION="$(node -p "require('./package.json').version")"
VSIX="execai-${VERSION}.vsix"
[[ -f "$VSIX" ]] || { echo "no $VSIX — run: npm run package" >&2; exit 1; }

if [[ $MS -eq 1 ]]; then
  [[ -f ~/.config/execai/vsce.pat ]] || { echo "no ~/.config/execai/vsce.pat" >&2; exit 1; }
  echo "==> Visual Studio Marketplace: $VERSION"
  VSCE_PAT="$(< ~/.config/execai/vsce.pat)" npx @vscode/vsce publish --no-dependencies --packagePath "$VSIX"
fi

if [[ $OVSX -eq 1 ]]; then
  [[ -f ~/.config/execai/ovsx.pat ]] || { echo "no ~/.config/execai/ovsx.pat" >&2; exit 1; }
  echo "==> Open VSX: $VERSION"
  npx ovsx publish "$VSIX" -p "$(< ~/.config/execai/ovsx.pat)"
fi

echo "==> done"
