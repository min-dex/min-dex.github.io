# Mindex Electron Packaging Plan

Mindex keeps the existing web UI as the renderer. Electron is only responsible for the desktop shell: stable Chromium runtime, native presenter windows, app updates, and later native helpers.

## Goals

- Same UI code as the web version.
- Windows-friendly installed app for non-technical users.
- Presenter output opens as a native fullscreen window, not a browser popup.
- Supabase remains the source of truth.
- Preserve local sessions, recovery drafts and preferences across updates.
- Updates should feel simple: notify, download, restart.

## Architecture

```text
Electron main process
├─ loads bundled index.html through loadFile (file://)
├─ creates controller BrowserWindow
├─ creates fullscreen presenter BrowserWindow
├─ owns auto-update lifecycle
└─ exposes a small preload bridge

Renderer
├─ existing index.html/app.js UI
├─ Supabase client with anon key only
├─ BroadcastChannel presenter state
└─ optional Electron bridge when installed app is running
```

## Update Strategy

Mindex uses GitHub Releases (`min-dex/min-dex.github.io`) through `electron-updater`,
matching `build.publish` in `package.json`.
Packaged apps check on startup. The main process owns update state across renderer
reloads. Downloads and installation both require operator confirmation. Automatic
installation on quit is disabled; do not silently update on ordinary app exit.

- Native `업데이트 → 업데이트 확인…` retries failed checks, reports the current
  version/download progress, or offers a downloaded update again after "later".
- Defer prompts while the native presenter is open. Main-process installation
  also rechecks the presenter window immediately before `quitAndInstall`.
- Renderer blocks installation while edits or saves are pending. Save first and
  use the update menu again. Update errors must not print token-bearing URLs.
- Only the controller window can invoke update IPC. Output-window reloads cannot
  download or install updates. Preload event subscriptions return unsubscribe.
- `MINDEX_DISABLE_UPDATES=1` keeps packaged test builds offline. Dev builds never
  check. The web app does not load the desktop updater.

## Preparing and building later

1. Use the pinned package manager and lockfile: `pnpm install --frozen-lockfile`.
2. Run `pnpm electron:check`. This is an offline check: updater/IPC/UI behavior,
   runtime inclusion and packaging config; it never publishes or reads secrets.
3. Bump `package.json` above the last desktop release, review and commit the
   checkout. Web asset version and desktop semantic version are independent.
4. Local unsigned check: `pnpm electron:pack:raw`. Distribution files without
   publishing: `pnpm electron:dist:mac:arm64`, `pnpm electron:dist:mac:x64`, or
   `pnpm electron:dist:win:x64`. These explicitly use `--publish never`.
5. When authorized to publish, run `pnpm electron:release:mac` on macOS (builds
   arm64 and x64 together) or `pnpm electron:release:win` on Windows (x64).
   `pnpm electron:release` selects the host platform. Release commands validate
   a clean committed checkout and credentials before cleaning local dist, force
   code signing, then publish and remove only intermediate unpacked directories.

Credentials are supplied by the release environment, never stored in this repo:

- Both platforms: `GH_TOKEN`, `CSC_LINK`, `CSC_KEY_PASSWORD` (the certificate
  must be appropriate to that platform).
- macOS: Developer ID Application certificate, plus notarytool API credentials
  (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`) or
  `APPLE_KEYCHAIN_PROFILE`. The pinned builder 24 uses a legacy path for
  `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`; unset those for this release path.
- Windows does not require Apple credentials. The certificate is still required
  by this project's release gate and `forceCodeSigning`.

The macOS artifact must be Developer ID signed and notarized. A local
`electron:pack` build is for testing only and must not be distributed. The local
pack script clears the quarantine attribute from `dist/mac-arm64/Mindex.app`
after building, which reduces Gatekeeper trash/block prompts on the developer
machine. It is not a substitute for signing and notarization; shared or
downloaded builds still need `pnpm electron:release`.

Use `pnpm electron:pack:raw` only when the unsigned app bundle needs to be
inspected exactly as electron-builder produced it.

## Release Versioning

- Increase the semantic version in `package.json` before every public desktop
  release. An installed app only accepts a strictly newer version.
- Build and publish from the reviewed commit, then tag that same commit as
  `v<version>` in GitHub.
- The GitHub Release must include the installer/archive and electron-builder's
  update metadata. Do not hand-upload only a DMG.

## Data And Schema

Supabase is the primary database. Electron should not add a competing local database.

Local data is limited to:

- Supabase session/cache managed by the client.
- Last opened screen state.
- Media/cache files if needed later.

Schema changes should be backward-compatible first. Old cache can be invalidated by a cache version instead of migrated.

Do not embed service role keys or private Supabase secrets in the desktop app.

## Verification boundary — 2026-10-11

Offline tests cover single-flight checks/downloads, network failure and retry,
install readiness, disabled updates, renderer reload state, deferred prompts,
unsaved edit protection and main-process IPC/live-output guards. Mac builds
include both DMG and ZIP; architecture-specific artifact names avoid collisions.
A release is not validated until a genuinely older signed installation upgrades
to the newer signed build on each supported OS/architecture. Verify relaunch,
version, preserved local drafts/session, and native presenter output. No signed
installer, notarization submission or GitHub Release was produced in this work.
