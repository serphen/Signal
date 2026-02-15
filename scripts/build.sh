#!/bin/bash
set -e

PLATFORM="${1:-mac}"
ARCH="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Skip interactive prompts
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_ENABLE_AUTO_PIN=0

echo "==> Installing dependencies..."
pnpm install --no-frozen-lockfile

echo "==> Building assets..."
pnpm run generate
pnpm run build:esbuild:prod

echo "==> Packaging (platform: $PLATFORM)..."

if [ "$PLATFORM" = "mac" ]; then
  if [ "$(uname)" != "Darwin" ]; then
    echo "ERROR: Building macOS .app requires running on macOS."
    echo "       Native modules (libsignal, sqlcipher, etc.) cannot be cross-compiled from Linux."
    echo "       Use './scripts/build.sh linux' to build for Linux instead."
    exit 1
  fi

  ARCH_FLAG=""
  if [ -n "$ARCH" ]; then
    ARCH_FLAG="--$ARCH"
  fi

  SIGNAL_ENV=production \
  CSC_IDENTITY_AUTO_DISCOVERY=false \
  SIGN_MACOS_SCRIPT="$SCRIPT_DIR/sign-macos-local.sh" \
    npx electron-builder --mac --dir $ARCH_FLAG \
      -c.mac.notarize=false \
      -c.forceCodeSigning=false

  echo ""
  echo "==> Build complete!"
  for dir in dist/mac-arm64 dist/mac-x64 dist/mac; do
    if [ -d "$dir/Signal.app" ]; then
      echo "    .app: $dir/Signal.app"
    fi
  done

elif [ "$PLATFORM" = "linux" ]; then
  SIGNAL_ENV=production \
    npx electron-builder --linux --dir

  echo ""
  echo "==> Build complete!"
  echo "    Output: dist/linux-unpacked/"

else
  echo "Usage: $0 [mac|linux] [arm64|x64]"
  echo ""
  echo "Examples:"
  echo "  $0             # Build macOS .app (native arch)"
  echo "  $0 mac arm64   # Build macOS .app for Apple Silicon"
  echo "  $0 mac x64     # Build macOS .app for Intel"
  echo "  $0 linux       # Build Linux app"
  exit 1
fi
