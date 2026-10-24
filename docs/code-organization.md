# Runtime Code Organization

This document records the stable 2026-08-16 runtime ownership boundaries. It
is a maintenance contract, not a request to split large files mechanically.

## Load Order

`index.html` must load the runtime scripts in this order:

1. Shared constants, design tokens, worship model and persistence helpers.
2. `mindex.presenter-praise.js`, then `mindex.presenter.js` (including slide-model constants).
3. `mindex.presenter-live.js`, `mindex.presenter-board.js`, `mindex.presenter-controller.js`.
4. Existing adapters and domain modules, then `app.js` bootstrap.

The exact ordered list remains in `index.html`. Modules are downloaded in parallel
and executed in that order; source and compiled app use the same dependencies.

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
- `app.js` owns bootstrap, state, persistence orchestration, DOM events and canonical shared helpers.
- `mindex.presenter-praise.js` owns song/score slide composition and form planning.
- `mindex.presenter-live.js` owns music transport, synchronized lyrics and live scripture actions.
- `mindex.presenter-board.js` owns board construction, grouping, selection and previews.
- `mindex.presenter-controller.js` owns navigation, output launch/synchronization and slide-model validation. These controller modules call the existing app state/save interfaces; they do not introduce another persistence owner.
- `styles.css` owns the initial shell and catalogue styles. `styles.workspace.css` continues at the original Service module boundary, including later shared editor overrides. Load it immediately after `styles.css`, before dedicated output styles; their concatenation preserves the original cascade byte for byte.
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
in app.js, song selection stays in mindex.presenter-praise.js and existing live modules
forward change notifications without rewriting service records.


## Presenter display projection ·2026-10-24

Keep the output pipeline in this order: stored slide/builders, derived fullscreen
title view, service artwork, frame/body rendering. `presenterFullscreenSongTitleView`
returns display-only data and never feeds a worship save or source serializer.
Unrelated and blank slides pass through unchanged; converted title views can be
applied repeatedly without changing their style. Copy title-content metadata
when constructing a view so view changes cannot edit its source. Keep stored
song forms, lyrics, links, order and audio timing in their existing owners.
The existing browser regression traps writes/deletes to source objects and checks
repeated rendering plus actual fullscreen title geometry.


The size audit failures observed at 819a0776/9da6dce8 are resolved by the
2026-10-24 role extraction. Original functions and CSS blocks move unchanged;
source-only hashes in `runtime-extraction-20261024.json` record their provenance.
Slide element/layout constants initialize in the presenter before controller
compatibility tables. Version save row construction is a named helper; field
values, mutation order and atomic save orchestration remain unchanged.

Old file/function/coupling ceilings are lowered; each extracted module has its
own line/function budget. The aggregate app/controller coupling count is also
bounded at its original 3,552, so moving state access cannot hide new coupling.
The audit checks global function ownership across the classic global scripts;
private IIFE-local helpers may share names. The size audit and dependency/desktop
packaging test are part of the required Cloud gate. Stalled-download recovery
covers every extracted module and the new stylesheet in both browser engines.

The live-read smoke runner keeps production mutations blocked. Startup server
state and monitor registration/presence use an ephemeral per-browser-context
fixture instead of contacting their production RPCs. Worship aggregate reads
are rewritten to GET in the browser, preserving PostgREST read-only transactions
without a serial Python HTTP proxy. Business songs, services and scripture are
still real read-only data. Fixture counts are reported separately from actual
reads; a blocked mutation or unknown RPC fails the run. The optional `--fail-fast`
mode and redacted progress labels diagnose the first failure without claiming
that skipped later checks passed. Fixture revision/replay/isolation and the
negative network guard have dedicated coverage. WebSocket routes remain local
mocks without connecting to a server; calling synchronous `close()` inside the
Playwright routing callback deadlocks the driver and is explicitly regression-tested.
Convenience `Browser.new_page` calls also use the shared guarded context factory,
so they retain the macOS native-fullscreen block before any document loads.

`python3 tests/run_live_readonly_smoke.py smoke_live_readonly_core` exercises real
startup, service hydration and slide rendering while comparing canonical loaded
service/section/element/song data before and after. Projected editor items may gain
normal rendering placeholders/indices; they are not canonical saved rows. This
explicit live test is separate from the offline CI gate.

### Broad live suite alignment ·2026-10-24

The broad `smoke_app` and `smoke_worship_presenter` suites now follow current
module tabs/typography, responsive layout, song/version selection and T/inline-note
contracts. Template defaults are tested twice: omitted persisted fields stay
empty, while the effective declaration resolver restores the specified sequence.
Existing populated closing hymns remain in projected all-generations services.
Creation fixtures exercise `create_praise_v1` and verify its returned identities,
without invoking a production mutation. Current storage assertions use the shared
storage API rather than retired local/session storage mirrors.

Output checks observe accepted payloads in the actual output document and use
the controller's current session nonce. Popup-only and desktop-API fixtures stub
the freshness preflight and background hydration, restore them and their session
state afterward, and do not invoke native fullscreen APIs. The separate unchanged
`smoke_presenter_freshness.py` covers fresh reads, failed reads, live lyric
isolation, restart, missing versions and navigation/cancellation races in both
browser engines. Disconnect assertions wait for the existing monitor cleanup.
This does not claim real native macOS fullscreen integration coverage.

Output registration/heartbeat/removal and HTTP broadcast fallback are exact-shape
local fixtures, isolated per browser context. They never contact production,
retain broadcast bodies, expose peers or save service content. Unknown actions,
extra fields, cross-host requests and canonical mutations still fail closed.
The exact vendor REST-fallback warning is expected only in guarded contexts where
the WebSocket is deliberately isolated. The known unused presenter-font preload
advisory is also distinguished from failures during rapid module switching;
its exact localhost/common-font URL and browser text must match. Font loading
errors and all other browser warnings/errors still fail.

Local guarded runs passed all130 app checks and129 presenter checks with no blocked
requests or production writes. The source-preservation live test separately read
8 saved services and rendered298 slides without changing canonical source data.
These live receipts complement, and never replace, the required offline GitHub gate.
The historical October13 receipt above remains historical.


A retained older HTML shell can discover a newer release whose dependency list
has grown. Before startup is scheduled, the app verifies its required presenter
modules and workspace stylesheet. A missing dependency refreshes the HTML once,
keeping route/query state and using the existing cache-bypass retry parameter.
The fresh HTML then runs the single existing ordered asset loader; no second
script loader races later peer modules. If the refreshed shell is still missing
dependencies, startup fails closed rather than looping or connecting to data.
The upgrade marker is removed after readiness. Normal HTML does not reload.
`smoke_runtime_dependency_upgrade.py` covers retained HTML, current startup,
all five asset error/retry cases, and failed refresh before connection/save.

Shared output-window/heartbeat status queries stay in app.js because later peer modules read them at load time. They remain available even while a retained HTML shell is being refreshed; their behavior is unchanged.


Shared input/presenter integration ·2026-10-24: supplemental authored-text fitting
is owned once by presenter-board alongside mini-preview composition and invoked
by the shared output fit path. Reallocate30 unused controller lines to the board
owner (2670/1730); keep the combined extracted-owner ceiling6550 and add an
explicit aggregate ceiling check. Core/function/coupling limits are unchanged.


### Output return and media status subscriptions ·2026-10-24

`mindex.presenter-history.js` owns session-only output history and its controller
adapters. It never writes worship, editor drafts or persisted history.
`mindex.presenter-media-state.js` owns the coalesced video event subscription and
cleanup; the existing output heartbeat remains the transport. Both load before
app bootstrap and ship in the desktop asset list.


## Praise persistence owner - 2026-10-25

`mindex.praise-storage.js` owns legacy/native Praise saving, lifecycle edits,
activation and catalog reads. It defines controller functions without startup
I/O, loads before app bootstrap, and uses the existing editor state boundary.
`mindex.single-song.js` remains the independent record/catalog/RPC model.
Late-input retention and offline activation tests cover the extracted owner;
the runtime-boundary test checks packaging and initialization. Existing main
file size/coupling ratchets are unchanged.
