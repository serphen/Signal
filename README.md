<!-- Copyright 2014 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

## Option 1: Devcontainer

Sandboxed Linux environment with all tools pre-installed (Node.js, pnpm, electron-builder, rcodesign, Claude Code). Builds a standalone `.app` (macOS) or binary (Linux). You can also use it for dev — just rebuild and reinstall the app after each change.

1. Install [OrbStack](https://orbstack.dev/) (lightweight Docker for Mac)
2. Install [VS Code](https://code.visualstudio.com/) + the **Dev Containers** extension
3. Clone the repo and open the folder in VS Code
```bash
git clone https://github.com/serphen/Signal-Desktop.git
```
4. In VS Code, open the `Signal-Desktop` folder, then press `Cmd+Shift+P` > **Dev Containers: Reopen in Container**
5. You're in. Build the macOS .app (Apple Silicon by default):
```bash
./scripts/build.sh
```

Other platforms:
```bash
./scripts/build.sh mac x64      # macOS Intel
./scripts/build.sh linux        # Linux
./scripts/build.sh windows      # Windows
```

## Option 2: Native build (no Docker)

Build and run directly on the host system, without Docker. Faster iteration since `pnpm start` gives you live dev mode with hot reload — no need to rebuild the whole app after each change.

```bash
git clone https://github.com/serphen/Signal-Desktop.git
cd Signal-Desktop
nvm install && nvm use
npm install -g pnpm
pnpm install && pnpm rebuild
```

Dev mode (live reload):
```bash
pnpm run generate
pnpm start
```

Build standalone `.app`:
```bash
./scripts/build.sh
```

The `.app` is in `dist/mac-arm64/` or `dist/mac/`. Launch with:
```bash
open dist/mac-arm64/Signal.app
```

## Tips

- **DevTools (Inspect Element):** `Cmd+Option+I`
