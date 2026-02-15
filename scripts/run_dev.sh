#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "==> Installing dependencies..."
  pnpm install
fi

# Generate assets if needed
if [ ! -f "preload.bundle.js" ]; then
  echo "==> Generating assets..."
  pnpm run generate
fi

echo "==> Starting Signal Desktop (dev mode)..."
pnpm start
