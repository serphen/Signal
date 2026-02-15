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

# Install deps only if needed (check pnpm marker, not just empty directory)
if [ ! -f "node_modules/.modules.yaml" ]; then
  echo "==> Installing dependencies..."
  pnpm install --frozen-lockfile=false --force
else
  echo "==> Dependencies already installed, skipping."
fi

echo "==> Building assets..."
pnpm run generate
pnpm run build:esbuild:prod

echo "==> Packaging (platform: $PLATFORM)..."

if [ "$PLATFORM" = "mac" ]; then
  ARCH_FLAG=""
  if [ -n "$ARCH" ]; then
    ARCH_FLAG="--$ARCH"
  fi

  if [ "$(uname)" = "Darwin" ]; then
    # On macOS: normal build with ad-hoc signing
    SIGNAL_ENV=production \
    CSC_IDENTITY_AUTO_DISCOVERY=false \
    SIGN_MACOS_SCRIPT="$SCRIPT_DIR/sign-macos-local.sh" \
      npx electron-builder --mac --dir $ARCH_FLAG \
        -c.mac.notarize=false \
        -c.forceCodeSigning=false
  else
    # On Linux: cross-build using prebuilt darwin binaries (skip native rebuild)
    echo "    Cross-building macOS .app from Linux (using prebuilt darwin binaries)..."

    NOSIGN="/tmp/nosign.sh"
    echo '#!/bin/bash' > "$NOSIGN" && chmod +x "$NOSIGN"

    SIGNAL_ENV=production \
    CSC_IDENTITY_AUTO_DISCOVERY=false \
    SIGN_MACOS_SCRIPT="$NOSIGN" \
      npx electron-builder --mac --dir $ARCH_FLAG \
        -c.mac.notarize=false \
        -c.forceCodeSigning=false \
        -c.npmRebuild=false

    # Ad-hoc sign with rcodesign if available
    if command -v rcodesign &>/dev/null; then
      for dir in dist/mac-arm64 dist/mac-x64 dist/mac; do
        if [ -d "$dir/Signal.app" ]; then
          APP="$dir/Signal.app"
          echo "==> Signing $APP with rcodesign..."
          find "$APP" -type f \( -name "*.dylib" -o -name "*.so" -o -name "*.node" \) -exec rcodesign sign {} \; 2>/dev/null
          find "$APP/Contents/Frameworks" -maxdepth 2 -name "*.app" -exec rcodesign sign {} \; 2>/dev/null
          find "$APP/Contents/Frameworks" -maxdepth 1 -name "*.framework" -exec rcodesign sign {} \; 2>/dev/null
          rcodesign sign "$APP"
        fi
      done
    fi
  fi

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
