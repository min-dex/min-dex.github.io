# Mindex Electron Packaging Plan

## Product release policy · 2026-10-30

The user requests installed packages and meaningful versioned updates as the
default product delivery path. A successful Pages deployment is a web build,
not a new installed-app release. Keep the existing web build identifier for
diagnostics, and show the installed semantic version separately.

- Patch: fixes and stability improvements; minor: compatible user-facing
  features; major: a reviewed product milestone or incompatible change.
- Each desktop release has a concise Korean changelog, exact source commit,
  matching version/tag, installers and updater metadata. Do not bump a product
  version for each intermediate CI run or internal web deployment.
- Installers bundle the verified renderer. Do not silently substitute a newer
  hosted renderer beneath an installed version.
- Updates require confirmation and preserve sessions, drafts and preferences;
  defer installation during output, pending edits or saves. An upgrade from the
  previous signed version must be tested before declaring update completion.
- The current `0.1.1` package value is historical configuration, not proof of a
  published desktop version. Check actual releases before choosing the next
  version. Mindex 2.0 remains held until its existing release conditions pass.
- Prepare and verify unsigned isolated packages locally first. Public signing,
  notarization and update publication retain the existing release safeguards;
  never read credentials to discover whether they are available.

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

## Isolated test packages and GitHub builds

- `pnpm electron:test:mac` builds Apple Silicon and Intel DMGs;
  `pnpm electron:test:win` builds the x64 NSIS installer. Outputs live in
  `dist/test/`. `electron-builder.test.cjs` uses the distinct `Mindex Test`
  name, `kr.mindex.app.test` identity and `mindex-test` package name, isolating
  user data from the production app. Do not copy production session files.
  The Supabase backend is still the same operational database: package isolation
  does not make edits disposable. Test navigation/output without creating fake
  services or altering curated worship data.
- These unsigned/unnotarized packages have a baked-in update-disable flag.
  They cannot download a production update or install over the official app
  through the updater. OS security prompts are expected; they are for local
  acceptance testing, not public distribution.
- GitHub `Desktop Packages` defaults to unsigned test artifacts, retained for
  seven days. Download them from the workflow run; no release is created. The
  packaging work branch triggers this same test path when build config changes.
- For a future signed build, manual `publish_release=true` requires the platform
  certificate secrets and, on macOS, `APPLE_API_KEY_CONTENTS` (p8 contents),
  `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`. The key is written only to runner temp
  and removed after the build. Do not paste credentials into chats or source.
- Signed jobs build both Mac architectures together so `latest-mac.yml` is not
  overwritten by competing jobs. Upload ZIP/DMG/EXE, blockmaps and latest YAML
  with original filenames. The final job creates a DRAFT for the exact source
  commit; existing releases/tags are rejected. Validate upgrades before manually
  publishing it. Tag pushes no longer publish anything automatically.
- Use current runners (`macos-15`, `windows-latest`) and Node 22 for pnpm 11.

## Integrity remediation — 2026-10-13

At that remediation Electron was pinned to43.7.9 (the maintained43 line), electron-builder to
26.15.3 and electron-updater to 6.8.9. Transitive packages were refreshed within
their supported ranges. The global-agent 3 override to 4.1.3 removes roarr's
vulnerable sprintf-js dependency; bootstrap/createGlobalProxyAgent stay available.
Squirrel Windows installer build scripts are explicitly disabled because the
Windows distribution uses NSIS. The pnpm lockfile and workspace policy are part
of the release input. Desktop CI audits the complete dependency graph, including
Electron even though it is classified as a development dependency.

Local validation uses an isolated unsigned Apple Silicon app and an ephemeral
Electron profile with external network blocked. Signed installation/upgrade on
customer Macs and Windows remains a separate physical acceptance test; it is
not implied by a successful web deployment or unsigned package build.


### Security patch repair ·2026-10-24

Keep `pnpm audit --audit-level=moderate` unchanged. Electron43.8.1 fixes the
[certificate-revocation advisory](https://github.com/advisories/GHSA-jr5w-w6x2-84p9).
The existing Undici6/7 branches use6.29.1/7.30.1 and fast-uri uses3.1.9;
scoped overrides replace only the vulnerable6.29.0/3.1.8 transitive versions.
The updater and builder versions, installer identity/isolation, signing gates,
user profile and database paths remain unchanged. Security audit10→0 and offline
updater/package preflight pass locally. Actual Mac/Windows CI installer creation
and publication evidence must be recorded separately; no signed release is implied.

## Shared product identity ·2026-10-30

`package.json.version` is the single product semantic-version source. Keep
`mindex-release.json.version` as the web asset/cache build identifier. The two
values have different jobs; intermediate web deployments do not bump products.
`product-release.json` owns the development/release channel, Korean changes and
upgrade notes. It intentionally has no duplicate product version. Version 0.1.1
remains development configuration: public GitHub Releases returned none during
this audit; the existing stable-2026-08-16 tag is not a versioned desktop release.

Pages staging and Electron beforePack generate `mindex-build.json` from the same
committed HEAD: product version, channel, exact source commit, web build ID and
a deterministic tree digest of shared renderer/scripts/assets/data. The generated
file is excluded from Git to avoid self-referential commit IDs. Pages still stages
only git archive bytes. Packaging refuses dirty tracked files, untracked runtime
assets and symlinks. Runtime includes now cover all Remote/draft modules and the
public runtime data directory. No private backups or credentials are included.

The app information section of the existing connection panel shows development
vs test vs release explicitly, with installed version separate from web build.
Missing receipt never claims a product release. Desktop always loads its bundled
renderer. Development/test packages cannot join automatic updates. Release
publication requires an explicitly reviewed release channel and an unused remote
version tag; reuse of an already published version is refused. Korean changelog
and exact source are included in the draft release. Existing output/dirty-edit
installation guards remain mandatory. No version bump, signing, notarization,
installation or public Release is authorized by this preparation.

Unsigned validation: commit the candidate, use the isolated test builder config
with identity discovery disabled and `--publish never`; never use operational
profiles. macOS/Windows installer and updater parity still require artifact and
upgrade verification before a formal product release. Synthetic checks cannot
certify physical output or signed upgrade behavior.

Formal web publication is additionally fail-closed: a `release` channel manifest
requires the remote `v<productVersion>` tag (peeled for annotated tags) to match
the exact source commit. Development builds do not consult remote tags. Build
signed desktop candidates first, verify upgrades and publish the reviewed version
tag/Release, then publish the matching formal web artifact. Later source changes
cannot continue claiming that formal version; return to development or review a
new version. None of these promotion steps have been performed by this work.
