<!-- Copyright 2014 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Signal Desktop — Build

The easiest way to build is with the devcontainer. Everything is pre-installed and isolated — just clone, open, and build.

## Quick start (recommended)

1. Install [OrbStack](https://orbstack.dev/) and [VS Code](https://code.visualstudio.com/) with the **Dev Containers** extension
2. Clone the repo
```bash
git clone https://github.com/serphen/Signal-Desktop.git
```
3. Open the `Signal-Desktop` folder in VS Code, then `Cmd+Shift+P` > **Dev Containers: Reopen in Container**
4. Build:
```bash
./scripts/build.sh
```

That's it. The macOS `.app` (Apple Silicon) lands in `dist/mac-arm64/Signal.app`.

Other platforms:
```bash
./scripts/build.sh mac x64      # macOS Intel
./scripts/build.sh linux        # Linux
./scripts/build.sh windows      # Windows (installs Wine on first run)
```

You can also use it for dev — just rebuild and relaunch the app after each change.

## Tips

- **DevTools (Inspect Element):** `Cmd+Option+I`

---

<details>
<summary>Alternative: native build (no Docker)</summary>

Build directly on the host. Useful if you want hot reload via `pnpm start` for faster iteration.

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

Output is in `dist/mac-arm64/` or `dist/mac/`.

</details>
