# Current Worship Persistence Contract

## Production Boundary (2026-10-06)

- Worship aggregate reads and instance writes require the RPC client and expected
  revisions. The cutover switch and direct-table fallback branches are removed.
  Card/archive listings and the read-only refresh module still use table reads.
- Pending writes are tab-scoped and project-scoped. Unknown outcomes retain the
  exact request for retry; a conflict must not silently replace newer data.
- An element patch serializes only its target, preserves other local drafts,
  and updates only the corresponding source block. Identical duplicate source
  blocks may be collapsed only for a single canonical item. Differing duplicates
  remain blocked for review.
- Full/element saves, linked-service sync, creation, deletion
  and live setlist-leader edits have only one instance-write path. Import-source
  archive edits are a separate, unchanged storage contract.
- Offline browser fixtures now exercise RPC rollback, frozen-request replay,
  conflict review, draft isolation and save queues. A resolved uncertain request
  requires reload; it never acknowledges a newer editable draft.
- Existing document slide arrays remain readable for fallback/recovery. This
  code cleanup does not remove production content or change DB permissions.
- `tests/test_worship_store.mjs` and `tests/test_worship_atomic_client.mjs`
  cover retry/revision handling. `tests/check_worship_atomic_live.py` checks a
  read-only production aggregate; it does not prove write permissions or writes.

## Element content patches preserve order (2026-10-16)

A content-only patch retains the target's committed `sort_order` when its
section is unchanged. Recomputing just that row from visible array position
mixed compact ordinals with untouched sparse/hidden-row ordinals and could move
an edited praise ahead of its siblings on reload. Full structural saves remain
responsible for renumbering the complete payload after add/delete/move.

Offline Chromium/WebKit coverage: sparse 10/20/30 positions, middle insertion,
explicit deletion, repeated single-item edits and database projection/reopen.
Production records are not repaired or reordered by this client fix.

## Scheduling preserves existing services (2026-10-13)

Scheduling creates missing eligible instances only. Calendar changes never
automatically delete existing services, including empty auto-generated drafts.
Deletion requires an explicit user action through the atomic delete path. The
unused automatic-cleanup helper was retired; lifecycle fixtures now call the
actual scheduler and verify existing services remain unchanged.

## Worship-owned audio bundle (2026-10-17)

`audio_praise` is stored through the compatible DB input mode with its exact mode
in config/content state. The item owns `audioAsset`, lyric screen boundaries and
`config.audioTiming` version1 (audio URL/hash/duration, lyric-layout fingerprint,
start times and enabled state). Portable source includes the same timing record.
The existing atomic element-save path commits the bundle; no new schema, song DB
write or separate shared-package lookup is involved. New uploaded objects are
immutable. An uncertain commit must not delete audio that may already be referenced;
the draft retains its upload URL for retry. Remote timing takes precedence over
legacy local cache; changed lyrics/photos/audio invalidate playback cues.

## Children song/version audio sets (2026-10-17)

Children audio remains a separate DB-owned mode. The existing song memo stores
`childrenAudioSets[versionId]`: immutable Storage audio URL/hash/duration, designated
forms, source/page fingerprints, cues and enabled state. New browser contexts read
the set with the song; local/shared bundles are migration inputs only. Normal song
serialization retains sets, and memo CAS rejects concurrent replacement. This
does not convert children items to worship-owned `audio_praise`.

## Historical Pre-Cutover Audit

The remainder records the September 11-16 non-atomic implementation. Its gaps
and proposed next steps do not describe the enabled production RPC path.
The former non-atomic fixtures were replaced on October 6. References to those
reproductions below describe historical tests, not the current test behavior.

## Element document isolation (2026-09-16)

An element Apply now builds its document from committed section/element rows
plus the target element, not the other local item drafts. It preserves existing
section metadata and replaces only the target's block in the committed source
text when one exists. A whole-source draft remains local. Ambiguous source blocks
are rejected before row writes rather than guessing.

Document slides use the explicitly supplied service/items without consulting the
live slide cache or scheduling Scripture hydration. The normal presenter path is
unchanged. Browser tests cover sibling/source draft isolation, preserved unknown
source text, late edits, failures and queue release. These changes do not make
the multi-request save atomic or add cross-client revision protection.

## Client payload validation (2026-09-16)

The client now rejects sections whose service_id differs from the save target,
elements whose section_id is absent from the submitted sections, and duplicate
section/element IDs. Full and single-element save tests inject a foreign section
and verify zero DB writes, retained drafts and released save locks.

This validates the submitted payload only. It does not verify ownership of an
existing ID against the live database, replace server constraints, make separate
requests atomic, or prevent stale-client document replacement. The partial-write
and cross-client overwrite reproductions below still succeed.

## Save receipt hardening (2026-09-11)

Full and element saves now request an exact affected-row count for the service
update and reject zero or missing counts without clearing the local draft.
Full saves advance the local source document baseline only after all row writes
succeed. Recovery-history equality compares the complete compact document,
excluding only its timestamp, so linked-source, layout and exception changes
are retained even when text/slide signatures are unchanged.

This is not transactional saving or cross-client revision checking. Partial
writes and concurrent ID-only replacements remain possible. No production
data, authentication, grants or RLS changes are included.

Offline verification: `tests/test_worship_save_receipts.cjs` exercises the
bundled SDK and history comparison; `tests/smoke_service_save_safety.py`
exercises draft retention and save queues in Chromium and WebKit.

Reviewed 2026-09-10 against the shared checkout of `app.js`,
`scripts/worship-schema.sql` and the existing save-safety tests. The checkout
contains concurrent work. This is a code/schema-source audit, not a production
catalog inspection or evidence of a specific lost production record. No data,
constraints or migrations were changed by this audit.

## Current representation

### Full-save failure boundary coverage (2026-09-14, offline verification)

`python3 tests/smoke_full_save_failure_boundaries.py` adds six synthetic cases in
each of Chromium and WebKit: failure before a write and response loss after a
committed write, at the service update, section upsert and element upsert stages.
The test runs the current browser save lifecycle and row conversion against a
stateful in-memory API double; all Supabase browser traffic is blocked.

Assertions cover immediate stop at the injected boundary, retained item content
and dirty IDs, unchanged local committed rows/source_ref, captured recovery draft,
released save lock, and a subsequent explicit successful retry with fake-server
state comparison without
duplicate stable IDs. Earlier fake-server writes remain committed: this deliberately
characterizes partial persistence, not transaction rollback. An all-written but
unacknowledged save must still retain the local draft.

Learning sources: FINDEX's
[`config-atomic-write-smoke.mjs`](../../Findex/scripts/config-atomic-write-smoke.mjs)
injects persistence failures and checks memory separately from disk; STUDEX's
`dbSaveEntry` checks its `updated_at` conditional-write receipt before finalization;
VITEX's [`Store.save`](../../Vitex/tools/local_store.py) preserves a recovery copy
on a revision/save error. MINDEX reuses the failure-boundary testing principle,
not those storage implementations or a second atomic-save protocol.

Not covered by this matrix: structural deletes, sibling synchronization, service
type defaults, concurrent clients, PostgreSQL rollback/locks, durable recovery,
and idempotent exactly-once retries. These remain separate acceptance work in
[the existing atomic-save design](worship-atomic-save-design.md). No runtime code,
production records, migration, permission or deployment changes accompany this test.

| Surface | Current implementation | Limit |
| --- | --- | --- |
| Service identity | `mindex_worship_services.id`, section and element UUIDs | Display labels and sort order are not stable IDs. |
| Instance data | Service row, section rows, element rows | Saved through separate API requests, not one transaction. |
| Content | `input_mode`, `content_state`, `asset`, `config`, `source_ref` and typed links | Optional column detection retains compatibility; JSON references are not foreign keys. |
| Behavioral slot | Persisted `source_ref.slotKey`; legacy `config.slotKey` / imported `slot_key` read adapter; runtime `_worshipSlotKey` | Current validator detects duplicate slots in its input only; no service-wide SQL uniqueness guarantee established by this audit. |
| Service document | `source_ref.mindexServiceDocument`: sourceText, sourceRecords, slides, exceptions, signatures | Coexists with normalized rows; not yet a single authoritative transactional aggregate. |
| Canonical content | `song_id`, `song_version_id`, `scripture_id`; resolved Scripture references and asset URLs | Canonical ownership stays outside Worship; persisted source/slides may also contain copied content. |
| Recovery | Browser-local snapshots and bounded, slim `mindexServiceDocumentHistory` in source_ref (source text + counts, not slides) | Best effort / bounded, not an independent durable audit log or rollback transaction. |

`buildServiceDocumentSnapshot` derives source text from an explicit draft or
current items, and slides from the presenter builder. Source records link text
records back to item/section/slot identities. These are coordinated projections,
not a completed source-text-only storage model. Do not remove compatibility
fields or the normalized rows on the assumption that the migration is complete.

The checked SQL declares foreign keys for service -> section -> element -> slide
with cascading child deletion, and nullable canonical references with SET NULL.
It does not declare JSON-to-record foreign keys, or a composite constraint proving
that a song version belongs to the linked song. Deployed constraints/triggers
must be inspected separately before asserting production integrity.

## Write paths

- `runServiceSave`: serializes saves in the current JS runtime; saves dirty
  service-type defaults first. It does not coordinate another tab/computer.
- `saveWorshipServiceInstance`: validates rows; updates service metadata/document;
  upserts sections; upserts elements; deletes removed elements; deletes removed
  sections; then updates local state. Earlier requests remain committed if a
  later one fails. The in-memory source_ref advances only after these instance row
  writes complete; retaining it on failure does not roll back earlier remote writes.
- `saveWorshipServiceElementPatch`: validates current rows; upserts the target
  section and element; updates the document from committed rows plus the target;
  then acknowledges only the target item's local dirty state. Other item/source
  drafts remain local. The requests still are not a transaction.
- Both paths use ID-only predicates for service updates, not an expected revision
  or updated_at comparison. Local signatures protect edits made during this
  runtime's request; they do not prevent overwriting a newer remote document.
- `saveDirtyServiceTypes` updates defaults independently. Success there followed
  by instance failure is not rolled back. Treat defaults as a separate operation.
- `syncSharedSundayContentAfterSave` runs after a successful source save, only
  for explicitly edited content whose persisted before/after values differ.
  Read-time sibling projection is disabled. Each service displays its own values.
  Existing same-date standard elements synchronize only when their content matches
  the source's previous value (or a retry value). Different values, local drafts,
  live output, duplicate slots, replacements, and absent rows are not overwritten.
  Targets use updated_at CAS with exact row receipts. Target document writes
  separately compare the previous source_ref. These writes are not transactional;
  a failed document write is reported and retried with the durable local job.
  A subsequent source save retries pending jobs; merely loading a service does not.

## Verified gaps and existing protections

1. **High: partial commits.** Failure of the document update after an element
   upsert leaves a new element with an old document. Full saves have the opposite
   write order and can leave a new document with old rows. UI error handling is
   not DB rollback.
2. **High: cross-client lost updates.** ID-only document replacement accepts a
   stale client's source_ref. A same-tab save queue is not compare-and-swap.
3. **Scope validation, partially hardened 2026-09-16.** The client now checks
   payload service/section membership and duplicate IDs, in addition to timestamps,
   modes and duplicate slots. Live database ownership of submitted IDs still needs
   server validation. Ordinary FK existence alone does not establish ownership.
4. **Recovery is limited.** Local snapshot failure warns but does not prevent
   save. Remote history shares the same overwrite path. The history size constant
   is measured with JS string length, and trimming retains one entry even above
   that limit; it is not a hard UTF-8 byte cap.

Existing protections remain valuable: loading rows before first persistence,
typed-state normalization, pre-write validation, retained content/suppression
markers, local dirty-state signatures, and same-runtime save serialization.
Do not remove them when adding server-side protection.

## Reproduction and next acceptance criteria

Run `node tests/audit_worship_persistence_contract.cjs`. It uses extracted current
functions with an in-memory API double; no browser, credentials or network. It
characterizes known gaps rather than proving safety. If a gap is fixed, replace
the corresponding characterization with the required safety assertion.

Next implementation should be separately scoped and reviewed:

The proposed protocol and rollout are in
[Atomic Worship Save Design](worship-atomic-save-design.md); this is design only,
not an implemented guarantee.

1. Define an expected aggregate revision and an atomic server operation for
   service document + sections + elements, including deletes. All instance write
   paths must participate; adding CAS only to the last document write is not enough.
2. Validate service ownership, canonical pair consistency and slot identity inside
   that operation. Reject stale/mismatched input without any committed row changes.
3. Define whether saving one element excludes other unsaved drafts from the
   authoritative document or intentionally saves the whole aggregate. Align the UI
   acknowledgement with that choice; do not silently change existing behavior.
4. Retain a recoverable previous revision and introduce idempotent request IDs.
   Test retries after uncertain network outcomes, failure at each write stage,
   stale clients, concurrent structure edits and fresh-client readback.
5. Confirm live schema/RLS and client rollout compatibility before any migration.
   A new client guard cannot constrain old clients still writing directly.

No broad JSON cleanup, curated-record normalization, table deletion or production
migration is authorized by this audit document.

## Read-only audit lookup cost (2026-09-14, offline verification)

`scripts/audit_mindex_content.py` now indexes song versions once instead of
linearly searching every version for each linked worship element. The first
matching duplicate ID is retained, matching the old lookup behavior; missing
references and warning order/content are unchanged. This adds an in-memory map
of references, not copies of version payloads. Fetch calls and selected columns
are unchanged; no production bandwidth or latency improvement is claimed.

`python3 tests/test_audit_version_lookup_cost.py` replaces fetches with synthetic
rows and counts version-row visits (not elapsed time):

| Versions / elements | Before | After |
| --- | ---: | ---: |
| 100 / 200 | 20,300 | 300 |
| 200 / 400 | 80,600 | 600 |

Both fixtures assert the complete expected warnings and counts. A separate case
protects first-duplicate and missing-reference semantics. The existing
`tests/test_audit_mindex_content.py` structural-warning test remains enabled.
This tool-only optimization is separate from the full-save failure matrix above;
it does not modify app runtime, Storage metadata, production DB or permissions.

Focused timing check on Python 3.9.6 / Darwin arm64, using the same 200-version /
400-element fixture: three warmups followed by 20 timed calls per variant in
alternating before/after order. Median was 18.641 ms before and 5.227 ms after;
nearest-rank p95 was 35.479 ms before and 11.527 ms after. Both variants produced
identical complete counts/issues/warnings on every call. The before variant
restored only the prior lookup in an in-memory module; no runtime file was reverted.
Timing includes the complete mocked audit invocation, excludes fixture creation,
imports and compilation, and makes no live network requests. These local samples
are not a production database, UI latency, or guaranteed speedup measurement.


### Linked-song presentation isolation · 2026-10-17

Sunday sync compares linked DB song score/lyrics display modes equivalently.
Mode-only changes do not enqueue sibling writes; song edits preserve each target's
existing score/lyrics and output mode. Retry records with older signatures are
normalized in memory, not rewritten. Shared song/version/form content and explicit
formPresetDisabled differences retain existing conflict rules. Manual lyric
conversion is still a content change. All writes keep the existing atomic path.


## Linked-song clear and vacant-hymn protection · 2026-10-17

Score/lyrics mode equivalence also covers an empty DB-song selection. Clearing
a shared song preserves the target service's score/lyrics input and output mode;
a subsequent mode-only edit of that empty slot does not enqueue sibling writes.
Manual-lyrics conversion remains a content change.

When the existing empty third-service hymn receives song 3 from service 1/2,
fill song/version but preserve any existing form hint, preset, preset rules or
explicit formPresetDisabled choice as a unit. A slot without form configuration
receives the source form as before. Populated targets retain the previous-content
conflict guard; local drafts, live output, all-generation and custom media guards
are unchanged. No new write path or production repair is introduced.

Validation covers both score/lyrics directions, clear, blank-mode comparison,
custom/disabled/unconfigured hymn forms and atomic row read-back in offline
Chromium/WebKit. Existing sync scope/CAS/retry and Cloud baseline checks remain.


## Linked-song hydration and retry guards · 2026-10-17

A vacant third-service hymn is determined from persisted song/version IDs, title
and manual slides, never from whether its song catalogue is already loaded.
Existing independent content retains the normal signature conflict guard. Form
configuration alone still permits the existing vacant-hymn fill with local form
preservation.

Pending Sunday sync requires exactly one eligible saved source matching the
queued content signature. Deleted, ambiguous, replaced or changed source items
cancel the stale job and report incomplete linked propagation without writing
the target. A unique unchanged source retains normal retry behavior.

Offline Chromium/WebKit regressions exercise actual mocked atomic rows with an
unhydrated independent hymn and pending retries with zero, one and two source
matches. Production data and schema are unchanged.

## Unchanged saves and document construction (2026-10-17)

The atomic client skips a write only when prepared rows, structure, metadata and
the document match its committed baseline. JSON object key order and the top-level
generated document updatedAt are ignored; arrays, lyrics, versions, forms and
medley order are not. Pending requests and known-conflict guards run first.
An unchanged save is not a remote refresh: later real edits still use the stored
revision and the server CAS guard. No schema or response contract is changed.
Full saves construct the outgoing document once, after canonical rows are built,
instead of building and discarding an earlier copy.

## Independent worship photo cues (2026-10-18)

Worship-owned `audioTiming.photos` stores ordered `{at,url,name}` records in the
existing atomic bundle. `at` is an absolute media time, with no lyric lead. The
original lyric starts, fingerprint, text and audio identity remain unchanged.
An optional zero-based `slideIndex` links a photo to a base lyric/blank slide.
Its effective time follows that slide's display start (including the existing
lyric lead); `at` is also saved as a resolved value for compatible readers.
Old entries without `slideIndex` remain absolute and are never auto-linked.
Photo assets use existing immutable worship media storage. Partial uploads and
uncertain saves retain uploaded URLs for retry; unlinking does not delete blobs.
No Praise DB or children-version attachment changes.


## Shared offering integrity · 2026-10-18

All-generation services share only the ordinary offering hymn with same-date
first/second services. Their praise sets and other formerly independent content
stay independent. Dated or explicit offering media/special songs remain replacements;
suppressed/hidden slots and concurrent/independent edits keep their existing guards.
An empty persisted offering can receive shared content while retaining local forms
and score/lyrics mode. A missing ordinary offering target reports incomplete sync
instead of silently succeeding; sync never creates a substitute element.

Ordinary all-generation templates include offering hymn then prayer. Source-text
insertions retain the existing section identity and relative order. Projection
deduplication includes semantic slot identity, not just ordinal; an entrance song
and a numbered praise item cannot donate/drop each other's content. All writes
still use the existing revision-checked atomic save. No schema change.

## Offering hymn/special toggle (2026-10-18)

The offering praise editor switches between 봉헌찬송 and 봉헌특송 using the
existing atomic element patch. It preserves song/version, lyrics, form, assets,
assignee and order; only the label, semantic slot and modified flag change.
Projection matches both variants to one offering position, preserving the chosen
slot. Special/media replacements are excluded from shared offering writes after
a fresh aggregate read, including ordinary Sundays. Returning to hymn keeps the
current content; it does not immediately replace it with another service's song.

## Three-way offering choice (2026-10-18)

The instance offering editor offers 찬송 / 특송 / 영상 at the same position.
Switching across praise/video retains separate compact content snapshots in
`config.offeringVariants`; snapshots exclude the snapshot container itself.
Atomic saves and row reloads preserve both sets. Hymn/special share praise
content; video restores its own title and asset. Video and special remain
excluded from shared hymn synchronization. No historical instances are migrated.

## Cross-device saved worship refresh (2026-10-18)

Successful atomic save/create/delete receipts emit identifier-only invalidations
through the shared Realtime socket and a local tab channel/storage fallback.
Receivers never write. The currently open clean worship reads one atomic aggregate
and adopts that exact revision and model together, including lyrics, ordering,
versions, forms and attachment/timing configuration. Other cached services are
invalidated for their next entry; new-list discovery remains the existing list load.
Selected editor rows follow their IDs across reorder, presenter anchors and scroll
are retained. Deleted open services retain their view and receive a one-time notice.

Focused inputs, local drafts, failed/pending saves, visible dialogs, output and
active media block adoption, including when they begin during the network read.
Conflicted atomic clients cannot silently adopt a new baseline. Wake/reconnect and
a visible idle 60-second check read only the selected service ID/save_revision to
recover missed signals. Equal revisions do not re-render. Both clients must load
the new release. This does not synchronize unsaved keystrokes, Praise DB/catalog
edits, templates or bulletin edits. No production schema/permission changes.

## Worship membership realtime · 2026-10-18

`operations-realtime.md` supersedes the new-list discovery limitation above.
Successful create/delete receipts now trigger read-only list reconciliation.
Open/deferred drafts survive remote deletion until the user leaves the editor
and draft protection clears. Existing aggregates/baselines are not list data.

Common settings/reference invalidations now share content realtime; see
`content-realtime.md`. Remote default changes are deferred while a worship,
Presenter or bulletin document is open; atomic baselines/documents stay intact.

List summary and archive invalidations now follow confirmed atomic saves as well
as create/delete. Remote list reads never adopt atomic baselines; archive reads
are detached metadata only. Existing live/import leader CAS paths are retained.
See operations-realtime.md for draft, playback and mixed-snapshot guards.
