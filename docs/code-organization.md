# Runtime Code Organization

This document records the stable 2026-08-16 runtime ownership boundaries. It
is a maintenance contract, not a request to split large files mechanically.

## Load Order

`index.html` must load the runtime scripts in this order:

1. `mindex.constants.js`
2. `mindex.design-tokens.js`
3. `mindex.presenter.js`
4. `app.js`

The order is checked by `tests/solid_audit.py`.

## Ownership

- `mindex.constants.js` owns static values shared by the app and presenter.
- `mindex.design-tokens.js` owns app-shell design tokens, button grammar
  labels, and shared UI copy. It must not own worship domain data.
- `mindex.presenter.js` owns slide construction and presenter-output helpers.
- `mindex.worship-model.js` owns pure worship slot, media-payload, and form-preset
  normalization rules, including media aliases, ordered decks, audio, timing,
  form tokens, singleton numbering, and default-preset normalization. These
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
