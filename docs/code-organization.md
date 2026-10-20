# Runtime Code Organization

This document records the stable 2026-08-16 runtime ownership boundaries. It
is a maintenance contract, not a request to split large files mechanically.

## Load Order

`index.html` must load the runtime scripts in this order:

1. `mindex.constants.js`
2. `mindex.design-tokens.js`
3. `mindex.presenter.js`
4. `mindex.pptx.js` (small adapter; renderer modules load only on demand)
5. `app.js`

The order is checked by `tests/solid_audit.py`.

## Ownership

- `mindex.constants.js` owns static values shared by the app and presenter.
- `mindex.design-tokens.js` owns app-shell design tokens, button grammar
  labels, and shared UI copy. It must not own worship domain data.
- `mindex.presenter.js` owns slide construction and presenter-output helpers.
- `mindex.pptx.js` owns PPTX inspection/import, bounded parsed-deck caching, and
  output effect sessions. It uses existing imported-deck asset normalization,
  presenter navigation/transport and atomic element saves. Vendored browser
  modules and their license/patch notice live in `vendor/web-ppt-0.4.5`.
- `mindex.worship-model.js` owns pure worship slot, media-payload, and form-preset
  normalization rules, including media aliases, ordered decks, audio, timing,
  form tokens, explicit numbering, and default-preset normalization. These
  rules run without controller state, DOM, storage, or database dependencies.
  Applying a default to an editable item stays with the caller; normalization
  does not turn an existing manual or song-default preset into a suggested one.
- `mindex.worship-source.js` owns the portable source grammar and serialization
  of resolved item fields. Song/translation lookups, source item selection,
  document snapshots, and save/conflict orchestration stay in `app.js`.
  `serializePortableServiceSourceItem` must run without app globals and preserve
  field ordering, empty-field distinctions, and multiline indentation.
- `mindex.worship-persistence.js` owns source-reference normalization, history
  compaction, and save-row construction, validation, preservation, and ordering.
  It loads before `app.js`; its helpers run after app bootstrap. It does not
  perform database I/O or access controller state/DOM directly.
- `app.js` owns bootstrap, state, persistence orchestration, DOM events, canonical shared
  helpers, and controller integration.
- A top-level function name has exactly one owner. Do not shadow or redeclare a
  function in another runtime file to change behavior through load order.
- User-facing behavior belongs in the current contract documents under
  `docs/`; incident notes and old drafts are not runtime specifications.

## Safe Refactoring Rule

Keep behavior changes separate from structural cleanup. Before moving a block,
first add or confirm a smoke test for its behavior. After moving it, run syntax
checks, `tests/solid_audit.py`, the app smoke suite, and the worship presenter
smoke suite.

The annotated Git tag `stable-2026-08-16` is the rollback point immediately
before this ownership cleanup.

## 2026-08-19 Structural Audit

The current stable version intentionally raised the ratchet ceilings after the
home/service navigation, presenter stability, praise input, and button grammar
work landed across multiple threads. This was a stabilization checkpoint, not a
new architecture target.

The app.js line ceiling includes a 6-line design-token bridge added on
2026-08-19 so shared navigation copy can come from `mindex.design-tokens.js`
without changing behavior. Lower that ceiling after the next UI extraction.

Known pressure points:

- `app.js` is still the integration hub for state, persistence, service input,
  controller UI, and app-level event delegation.
- `bindStaticEvents` and `handleDetailClick` are the highest-risk growth areas
  because new controls often enter through those event routers.
- Service navigation now has two explicit sentinel panels:
  `SERVICE_WEEK_PANEL_ID` for `이번 주 예배` and `SERVICE_LIST_PANEL_ID` for
  `전체 예배`. Home keeps its own `이번 주 예배` dashboard copy.
- Do not move presenter slide construction into app UI code. Keep output
  rendering in `mindex.presenter.js`, and keep controller/service authoring in
  `app.js` until an extraction has smoke coverage.

Recommended extraction order:

1. Move pure worship parsing and song lookup helpers out first.
2. Move service dashboard/list rendering helpers only after the service-tab
   smoke tests cover `이번 주 예배`, `전체 예배`, and direct service opening.
3. Split controller presenter-board helpers after Chrome output/reload smoke
   remains stable.
4. Split CSS by module only when visual smoke screenshots or pixel checks cover
   the affected presenter/controller surfaces.

## Baseline Ratchets

The size and coupling limits in `tests/solid_audit.py` describe the current
stable ceiling, not the desired final architecture. Lower the limits whenever
code is safely extracted. Raising them requires a documented reason in the
same change.


## Unused runtime cleanup — 2026-10-13

Audited tracked runtime JavaScript/HTML references against tests, scripts and
current documentation at `8c60ad88`. Removed 39 unreferenced top-level functions
(including newly orphaned helpers) and the two obsolete right-sidebar toggle
functions with their event wiring. This is deletion-only runtime cleanup: the
presenter rail remains fixed, and current templates, persistence, source/version
normalization and output navigation remain authoritative.

Removed CSS for the retired sidebar editor, authoring count strip, toggle button,
and the old `service-bulletin-*` screen/print path. The current bulletin renderer
uses `mindex.bulletin.js` and `styles.bulletin.css`; its saved content, layouts and
print behavior are unchanged. Upload-cache tests now recognize both actual file
variable names, retaining assertions for both upload paths and `upsert: false`.

Validation: 58 non-browser CJS test files passed; structural audit passed without
raising limits; syntax and diff checks passed. Offline browser coverage passed
for blackout and number navigation in Chromium/WebKit, preparation defaults,
citation rail at three widths in both engines, and bulletin workbench/children/
editorial layouts. Sidebar-reuse focus coverage originally raced the two-animation-frame
`ui-booting` visibility gate. The test now waits for the actual visible shell,
asserts initial focus acquisition, and blocks all external requests. It does not
weaken draft, selection, scroll or DOM-identity assertions. No production database mutation, web deployment or desktop
rebuild was performed for this cleanup.

Retain helpers still used by tests, externally exposed module APIs, saved-data
compatibility adapters, operational SQL and historical recovery evidence until
specific retirement evidence exists. Static non-use alone is not sufficient for
those boundaries.


## Retired left preparation input — 2026-10-13

Removed the unused left-sidebar preparation renderer, its field-style option,
left-only focus/draft lookup branches and associated CSS. The active right-rail
renderer `renderPresenterServiceInputRail` remains the single preparation UI.
Also removed unreferenced thumbnail-caption and old form-control styles.

Preparation fixtures now render the actual right rail. Offline Chromium/WebKit
coverage verifies 22 service/date cases, default values and retained drafts,
Enter navigation to the next field and to the apply button from the last field.
The broader app smoke assertion now checks the active rail instead of accepting
an empty status from the retired renderer. No saved data format or database
behavior changes; application of input still uses the existing save path.

Integration note: concurrent commit `3eaa7f09` added three active helpers and
17 app lines for parallel linked-song hydration/projection reuse. Preserve that
reviewed change; set the integrated app ratchets to 33,016 lines / 1,768 functions.
This does not restore the retired input or relax CSS/coupling limits.


## Retired test-only runtime helpers — 2026-10-13

Removed 16 unused runtime functions (15 in app.js and one in worship-input),
including obsolete shared-content copying/materialization, the unused automatic
service purge, and trivial preview, preparation, display and output wrappers.
The linked-song hydration wrapper became unused after parallel loading; the
active load/publish functions remain. Production single-slide validation remains;
the test-only result aggregator now lives in tests/helpers/presenter-diagnostics.js.
Tests are excluded from desktop runtime packaging.

Regression assertions now exercise current parser, display, output context,
sync and persistence functions. Persisted song-version IDs are checked against
the real FK eligibility flag; memo-only versions must not become foreign keys.
Existing guarded sync tests still cover conflicts, drafts, dates and one-way
ownership. The scheduler fixture verifies that loading a changed calendar never
removes existing services; explicit deletion retains its atomic retry tests.

Validation: 59 non-browser CJS suites, 18 worship-rule checks, atomic store/client
tests, syntax/diff checks and the tightened structural audit passed. Offline
Chromium/WebKit checks passed for lifecycle retries/scheduler preservation,
restored blank slides, 22 preparation cases and sidebar focus/reuse transitions.
The migrated shared-content smoke block was also executed in both engines with
local song/version fixtures. The full live-data app/presenter smoke suites were
not run; no production data was written. Ratchets now match 32,804 app lines,
1,753 app functions, 3,129 coupling markers and 8,430 CSS lines.

The final reference pass also removed the date and service-part helpers used
only by retired functions. No newly orphaned app functions remain from this pass.


## Full live-data smoke alignment — 2026-10-13

Run the suites through the guarded entry point:

```sh
python3 tests/run_live_readonly_smoke.py check_guard
python3 tests/run_live_readonly_smoke.py smoke_app
python3 tests/run_live_readonly_smoke.py smoke_worship_presenter
```

The runner uses only the public shipped config, refuses local environment-file
reads, blocks non-read network methods and unknown RPCs in every browser context,
and invokes the STABLE aggregate read RPC through GET (a PostgREST read-only
transaction). Service workers and WebSockets cannot bypass the request guard.
A blocked request makes the run fail. Redacted detailed logs and request summaries
are written to the system temporary directory. This does not test live writes;
atomic mutation/retry coverage remains in the offline fixtures.

The full suites now follow the current desktop canvas, compact topbar action
column, separate preparation rail, announcement regions, accessible prayer
field groups, and distinction between regular blank slides and safety blackout.
Geometry assertions verify actual bounds instead of obsolete fixed panel heights.
The Enter-commit guard renders a temporary current input control and restores the
in-memory item list afterwards. Catalog hydration finishes before fixtures replace
songs, and the hymn-search fixture excludes matching live records. Explicitly
linked praise is compared to the same source song's content state instead of
assuming that real data is always missing.

Verification: app 130/130 and presenter 128/128 passed with live reads enabled,
zero attempted production mutations, and both page/console-error checks passed.
The guard's six mutation/unknown-RPC denial checks also passed without networking.
No product runtime or production data change was required to resolve the failures.

The presenter suite closes its browser context (including output popups) before
closing the browser transport. Hover readiness and geometry are sampled in one
poll result so a board refresh between separate evaluations cannot invalidate the
sample. Concurrent browser-audit fixes from 153c295d were integrated and preserved.

## Initial icon payload · 2026-10-17

Bootstrap loads versioned `mindex.icons.js`, generated with
`node tools/build_ui_icons.cjs` from the retained, SHA-256 pinned Lucide vendor.
Its upstream SVG/createIcons runtime is copied unchanged, with a conservative
icon set selected from root runtime JS/HTML tokens (including conditional names).
Regenerate after adding icons; the Cloud gate checks freshness and upstream SVG
parity. Dynamically assembled names must be added as full literal names to their
runtime owner. Do not introduce arbitrary persisted icon names without extending
this contract. The desktop package includes the same generated asset.

The subset is 181 of 1,982 exported icon names, 35,688 instead of 409,163 decoded
bytes. This reduces initial transfer, but does not establish a fixed cold-start
latency: native uncached probes showed highly variable network receipt times,
including tiny resources stalled together. Keep network timing separate from
JavaScript execution and from warm-connection results.

## Compact runtime and presenter fonts · 2026-10-17

The logical `app.js` dependency may load `app.runtime.js` when the resolved
release equals `compiledAppVersion` in `index.html`. Source remains in `app.js`;
never edit the generated runtime. A different release uses its fresh `app.js`
until regenerated, so an old HTML shell cannot select a stale compiled bundle
for a new release. Existing ordered execution, one-download retry and the shared
startup deadline remain authoritative.

After changing source/release, regenerate using the optional pinned tools:

```
pnpm --dir tools/builddeps --ignore-workspace install --frozen-lockfile --ignore-scripts
node tools/build_app_runtime.cjs
node tests/test_app_runtime.cjs
```

Terser 5.44.0 removes whitespace and shortens local bindings, with `compress:false`;
properties, top-level APIs and named functions/classes are preserved. The default
Cloud hash gate requires only Node, and rejects stale *active* compiled code.
The Electron include list contains both source and runtime; this is not a signed
desktop package certification.

`tools/build_presenter_fonts.py` builds six immutable common-glyph WOFF2 faces
from the retained Freesentation originals using fontTools 4.60.2 / Brotli 1.2.0.
The 3,216 codepoints are fixed by the UI common charset, source symbols and all
kerning pairs, never by live worship data. Original full faces remain the fallback
for every other codepoint. CSS ranges are disjoint; common and fallback rule groups
stay adjacent to compress efficiently. Preserve OFL copyright/license records;
derived internal names are Mindex Presenter Common. Do not remove full originals.

`tests/test_presenter_fonts.py` checks 19,296 exact outline/advance comparisons,
vertical metrics and legacy/GPOS kerning. `smoke_presenter_font_cache.py` checks
real browser cache across fresh releases, original-vs-subset wrapping including
rare/common boundaries, and compiled-vs-source selection in Chromium/WebKit.
Rare characters can download the original full face in addition to the common
face; the reduction is for ordinary common-character output, not all scripts.


## Server-state modules · 2026-10-19 (pending deployment)

`mindex.server-storage.js` loads before the application runtime. It owns confirmed
memory mirrors, coalesced dispatch and server-state initialization; dynamically
loaded `mindex.server-state.mjs` owns revision/request identity and
`mindex.legacy-state.mjs` owns the allowlisted legacy migration. The editor draft
adapter `mindex.editor-drafts.js` loads after app globals. None replaces the atomic
worship RPC or independently publishes a deployment.
## Canonical values and aliases · 2026-10-19

Bible short-name and alias objects have one owner in `mindex.constants.js`; app code consumes them. UI selects use strict canonical values; the portable source/read boundary resolves known aliases through lookup-only keys. Praise classification arrays are ordered sets, whereas worship/form/version/lyric arrays are ordered content and must not be sorted for cleanup.

`mindex.presenter-freshness.js` owns read-only output-start DB revalidation,
blank-window reservation, live song snapshots and change notifications. It is
loaded before app.js; hooks execute after bootstrap. Output orchestration stays
in app.js, song selection stays in mindex.presenter.js and existing live modules
forward change notifications without rewriting service records.
