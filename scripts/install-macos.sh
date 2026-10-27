#!/bin/bash
# Build a local development app; does not modify Gatekeeper or downloaded apps.
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'This installer must run on macOS.' >&2
  exit 1
fi
if [[ "${1:-}" != '' && "${1:-}" != '--build-only' ]]; then
  echo 'Usage: bash scripts/install-macos.sh [--build-only]' >&2
  exit 1
fi
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Install Node.js 22+ first.' >&2; exit 1; }
command -v pnpm >/dev/null || { echo 'Install pnpm 11.25.0 first.' >&2; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22) process.exit(1)'
arch="$(node -p 'process.arch')"
case "$arch" in
  arm64) bundle='dist/mac-arm64/Made Mail.app' ;;
  x64) bundle='dist/mac/Made Mail.app' ;;
  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac
pnpm install --frozen-lockfile
pnpm run check
pnpm test
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --dir "--$arch" --publish never
pnpm desktop:smoke "$bundle/Contents/MacOS/Made Mail"
if [[ "${1:-}" == '--build-only' ]]; then
  echo "Built and smoke-tested: $PWD/$bundle"
  exit 0
fi
# User Applications avoids sudo. Preserve the existing app as a rollback copy.
destination="$HOME/Applications"
mkdir -p "$destination"
target="$destination/Made Mail.app"
if pgrep -f "$target/Contents/MacOS/Made Mail" >/dev/null; then
  echo 'Quit the installed Made Mail app, then run this script again.' >&2
  exit 1
fi
backup=''
if [[ -e "$target" ]]; then
  backup="$destination/Made Mail.backup.$(date +%Y%m%d%H%M%S).$$.app"
  mv "$target" "$backup"
fi
if ! ditto "$bundle" "$target"; then
  rm -rf "$target"
  if [[ -n "$backup" ]]; then mv "$backup" "$target"; fi
  exit 1
fi
echo "Installed local development build: $target"
echo 'Open Made Mail from your user Applications folder. This is not a notarized public release.'
if [[ -n "$backup" ]]; then echo "Previous app retained at: $backup"; fi
