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
  ARCH_FLAG=""
  if [ -n "$ARCH" ]; then
    ARCH_FLAG="--$ARCH"
  fi

  if command -v codesign &>/dev/null; then
    # On macOS: electron-builder handles signing via our script
    SIGNAL_ENV=production \
    CSC_IDENTITY_AUTO_DISCOVERY=false \
    SIGN_MACOS_SCRIPT="$SCRIPT_DIR/sign-macos-local.sh" \
      npx electron-builder --mac --dir $ARCH_FLAG \
        -c.mac.notarize=false \
        -c.forceCodeSigning=false
  else
    # On Linux: electron-builder skips signing, we do it after with rcodesign
    if ! command -v rcodesign &>/dev/null; then
      echo "ERROR: rcodesign not found. Install it or run on macOS."
      exit 1
    fi

    # Use a no-op sign script (electron-builder skips it on Linux anyway)
    NOSIGN="/tmp/nosign.sh"
    echo '#!/bin/bash' > "$NOSIGN" && chmod +x "$NOSIGN"

    SIGNAL_ENV=production \
    CSC_IDENTITY_AUTO_DISCOVERY=false \
    SIGN_MACOS_SCRIPT="$NOSIGN" \
      npx electron-builder --mac --dir $ARCH_FLAG \
        -c.mac.notarize=false \
        -c.forceCodeSigning=false

    # Sign with rcodesign after the build
    for dir in dist/mac-arm64 dist/mac-x64 dist/mac; do
      if [ -d "$dir/Signal.app" ]; then
        APP="$dir/Signal.app"
        echo "==> Signing $APP with rcodesign..."
        find "$APP" -type f \( -name "*.dylib" -o -name "*.so" -o -name "*.node" \) -exec rcodesign sign {} \; 2>/dev/null
        find "$APP/Contents/Frameworks" -maxdepth 2 -name "*.app" -exec rcodesign sign {} \; 2>/dev/null
        find "$APP/Contents/Frameworks" -maxdepth 1 -name "*.framework" -exec rcodesign sign {} \; 2>/dev/null
        rcodesign sign "$APP"
        echo "    Signed: $APP"
      fi
    done
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
