# SOLID Refactor Notes

This note is the lightweight guardrail for Mindex refactors. The app is still a
static HTML/CSS/JS app, so the goal is not to force a class-heavy architecture.
Use SOLID as a way to keep change boundaries small and predictable.

## Current Risk Shape

- `app.js` is the main pressure point. It contains app shell logic, data loading,
  persistence, rendering, editor events, Worship templates, Presenter controls,
  Presenter output, Praise, Scripture, Calendar, and References.
- Small visible bugs can take too long because the same change often crosses
  slide rendering, presenter output, preview thumbnails, DB fallback/loading,
  and service templates. Treat this as an operational bottleneck, not just a
  code-style concern.
- The main SOLID risk is `SRP`: several functions own event routing, state
  mutation, DOM rendering, and persistence decisions at the same time.
- `OCP` is the second risk: adding new service element types or presenter output
  behavior often means editing large conditional functions.
- `DIP` is a future risk: domain decisions are close to Supabase, localStorage,
  BroadcastChannel, and DOM APIs.
- `LSP` is not a major current concern because the app does not rely on class
  inheritance.

## Refactor Rules

- For live-service bugs, prefer a narrow hotfix first, then a minimal targeted
  smoke test. Batch broader verification after related fixes are grouped.
- Do not split files just to split files. First create small stable boundaries
  inside the current file, then move them if the boundary holds.
- Prefer registry/table-driven dispatch for action handlers and presenter
  element builders.
- Keep behavior-preserving refactors separate from feature work.
- Avoid touching broad dispatcher functions when another thread is likely editing
  `app.js`; add tests or docs first, then perform narrow extraction.
- Every important behavior refactor should add or update smoke coverage.

## Safe Sequence

1. Add guardrails and diagnostics.
2. For urgent Presenter/Worship fixes, make the smallest safe hotfix and add a
   regression smoke where possible.
3. Extract pure helpers from large functions without changing call sites.
4. Convert presenter element building to a type-to-builder map.
5. Convert detail event handling to action registries.
6. Move stable modules out of `app.js` only after their boundaries stop changing.

## Operational Speed Goal

The practical goal is faster live-service maintenance:

- Simple UI/display regressions should be fixable without reading unrelated
  Praise, Scripture, Calendar, or persistence code.
- Presenter output behavior should be isolated from controller rendering and
  authoring UI wherever possible.
- Worship service templates, slide builders, and output contexts should have
  clear boundaries so `fullscreen`, `chromakey`, `preview`, and `output` changes
  do not repeatedly touch the same large conditional blocks.
- Verification should scale with risk: hotfix + targeted smoke first, full app
  audit before commit/deploy or after a batch of related changes.

## Guardrail

Run:

```bash
python3 tests/solid_audit.py
```

The audit is intentionally conservative. It does not demand a perfect SOLID
score today. It prevents the known large functions and global coupling markers
from growing silently while Mindex is still being stabilized.

## 2026-10-06 Persistence Checkpoint

Save-row construction, validation, ordering, and preservation now have one
owner in `mindex.worship-persistence.js`. The 19 moved function bodies are
unchanged; RPC orchestration remains in `app.js`. Local functional checks cover
atomic full/partial saves, linked services, rollback, lifecycle, citation
editing/deletion, image round-trips, and the app shell. Production-config-dependent
smoke cases were skipped; this is not production-data verification.

The unchanged SOLID audit still fails against existing baseline debt. This is
not a passing audit and no thresholds were raised:

| Metric | Baseline `06e800e7` | Checkpoint | Limit |
| --- | ---: | ---: | ---: |
| app.js lines | 34209 | 33569 | 27268 |
| presenter lines | 5495 | 5495 | 4259 |
| styles lines | 8837 | 8837 | 7629 |
| app functions | 1821 | 1802 | 1472 |
| presenter functions | 305 | 305 | 251 |
| global coupling markers | 3156 | 3156 | 2519 |

This narrows ownership, but does not reduce the total runtime code size or
global coupling. Function-name collisions remain zero and navigation geometry
remains 47/47. Further extractions require independent regression coverage.

### Media Model Checkpoint

The next bounded extraction moves seven media-payload helpers and their two
kind constants into `mindex.worship-model.js`. Declaration bodies and all
remaining app statements are unchanged. The model executes in an isolated VM
without app globals; tests cover ordered decks, alias normalization, audio,
timing, input immutability, and canonical round-trips. UI, upload orchestration,
and RPC behavior remain with their existing owners.

After this phase, app.js has 33440 lines and 1795 functions: 129 lines and seven
functions fewer than the persistence checkpoint. All other audit metrics above
are unchanged. The six global ratchet failures remain baseline debt, not a pass.

### Form Preset Checkpoint

Ten form-preset normalization helpers and four related constants move from
app.js to the existing model. Default application and editable item state stay
with the caller. The declarations and remaining app AST are unchanged. Tests
pin token aliases, order/repeats, singleton and variant identity, default hymn
upgrades, explicit manual/forced/song-default preservation, metadata precedence,
and JSON persistence round-trips.

Against `c593f5f4`, app.js drops from 33440 to 33191 lines and from 1795 to 1785
functions. The audit's coupling marker count drops from 3156 to 3152 because
the extracted singleton helper has a local variable named `state`; this is
not a reduction in actual global state access. Presenter/CSS metrics, thresholds,
and geometry are unchanged; the same six global ratchets still fail.
