#!/bin/bash
set -e

PLATFORM="${1:-mac}"
ARCH="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "==> Installing dependencies..."
pnpm install

echo "==> Building assets..."
pnpm run generate
pnpm run build:esbuild:prod

echo "==> Packaging (platform: $PLATFORM)..."

if [ "$PLATFORM" = "mac" ]; then
  # Ad-hoc signing: use codesign on macOS, rcodesign on Linux
  if command -v codesign &>/dev/null; then
    SIGN_SCRIPT="$SCRIPT_DIR/sign-macos-local.sh"
  elif command -v rcodesign &>/dev/null; then
    SIGN_SCRIPT="/tmp/rcodesign-adhoc.sh"
    cat > "$SIGN_SCRIPT" <<'SIGNEOF'
#!/bin/bash
rcodesign sign "$1"
SIGNEOF
    chmod +x "$SIGN_SCRIPT"
  else
    echo "ERROR: No signing tool found. Install rcodesign or run on macOS."
    exit 1
  fi

  ARCH_FLAG=""
  if [ -n "$ARCH" ]; then
    ARCH_FLAG="--$ARCH"
  fi

  SIGNAL_ENV=production \
  CSC_IDENTITY_AUTO_DISCOVERY=false \
  SIGN_MACOS_SCRIPT="$SIGN_SCRIPT" \
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
