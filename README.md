<!-- Copyright 2014 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

## Setup (macOS)

1. Install [OrbStack](https://orbstack.dev/) (lightweight Docker for Mac)
2. Install [VS Code](https://code.visualstudio.com/) + the **Dev Containers** extension
3. Clone and open:
```bash
git clone https://github.com/serphen/Signal-Desktop.git
code Signal-Desktop
```
4. In VS Code, press `Cmd+Shift+P` > **Dev Containers: Reopen in Container**
5. Wait for the container to build (first time only), then you're in a ready-to-go Linux environment

## Dev mode

```bash
./scripts/run_dev.sh
```

## Build standalone .app

```bash
./scripts/build.sh              # macOS .app (default)
./scripts/build.sh mac arm64    # macOS .app for Apple Silicon
./scripts/build.sh mac x64      # macOS .app for Intel
./scripts/build.sh linux        # Linux app
```

Output: `dist/mac-arm64/Signal.app`, `dist/mac/Signal.app`, or `dist/linux-unpacked/`.

The build script auto-detects the environment: it uses native `codesign` on macOS
and `rcodesign` (Mozilla) on Linux for ad-hoc signing. No Apple certificate needed.

On macOS, launch with:
```bash
open dist/mac-arm64/Signal.app
```

## Manual setup (without devcontainer)

```bash
nvm install && nvm use
npm install -g pnpm
pnpm install && pnpm rebuild
```

---

# Signal Desktop

Signal Desktop links with Signal on [Android](https://github.com/signalapp/Signal-Android) or [iOS](https://github.com/signalapp/Signal-iOS) and lets you message from your Windows, macOS, and Linux computers.

[Install the production version](https://signal.org/download/) or help us out by [installing the beta version](https://support.signal.org/hc/articles/360007318471-Signal-Beta).

## Got a question?

You can find answers to a number of frequently asked questions on our [support site](https://support.signal.org/).
The [community forum](https://community.signalusers.org/) is another good place for questions.

## Found a Bug?

Please search for any [existing issues](https://github.com/signalapp/Signal-Desktop/issues) that describe your bug in order to avoid duplicate submissions.

## Have a feature request, question, comment?

Please use our community forum: https://community.signalusers.org/

## Contributing Code

Please see [CONTRIBUTING.md](https://github.com/signalapp/Signal-Desktop/blob/main/CONTRIBUTING.md)
for setup instructions and guidelines for new contributors. Don't forget to sign the [CLA](https://signal.org/cla/).

## Contributing Funds

You can donate to Signal development through the [Signal Technology Foundation](https://signal.org/donate), an independent 501c3 nonprofit.

## Cryptography Notice

This distribution includes cryptographic software. The country in which you currently reside may have restrictions on the import, possession, use, and/or re-export to another country, of encryption software.
BEFORE using any encryption software, please check your country's laws, regulations and policies concerning the import, possession, or use, and re-export of encryption software, to see if this is permitted.
See <http://www.wassenaar.org/> for more information.

The U.S. Government Department of Commerce, Bureau of Industry and Security (BIS), has classified this software as Export Commodity Control Number (ECCN) 5D002.C.1, which includes information security software using or performing cryptographic functions with asymmetric algorithms.
The form and manner of this distribution makes it eligible for export under the License Exception ENC Technology Software Unrestricted (TSU) exception (see the BIS Export Administration Regulations, Section 740.13) for both object code and source code.

## License

Copyright 2013-2024 Signal Messenger, LLC

Licensed under the GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html
