## Indexed catalog transport candidate ·2026-11-06

A server that advertises `catalogIndex: 1` may supply a manifest-bound, ordered
list of active record IDs and revisions from one SQL statement snapshot. The client
validates the exact count, identity and revision domain. It requests only IDs
missing from a checksum-verified same-project, same-epoch snapshot or with a
changed revision. Removed IDs disappear by rebuilding in index order. The batch RPC uses exact active IDs so historical aliases and tombstones cannot
enter the catalog. Cold profiles use the same index to request disjoint batches of at most 100 IDs,
with at most three reads in flight. SQLSTATE 57014 reduces the shared size for
queued batches and subdivisions to 50, then 25. Workers already in flight
finish without restarting successful work. The client
requires the expected ID and revision for every fetched row, validates the
complete catalog and checks fresh final status before installation. It drains
failed workers before falling back to the existing range transport.

A separately reviewed additive server migration installs the index and batch RPC. The existing clients
continue to accept status responses with the new optional capability, and the
new client retains the old path on servers without it. Apply only after the
live function definitions, read roles and revision invariants have been
reviewed. All writes that change a published payload must advance its revision
or change epoch. The explicit rollback removes the capability and index only.
The isolated PostgreSQL and browser fixtures verify payload parity, access,
maintenance, read errors, cache corruption and migration rollback. Synthetic
transfer reductions require public measurement before making latency claims.
The optional public probe counts by-ID requests without retaining IDs, and can
seed a disposable local snapshot with one stale revision.

## Private activation snapshot ownership ·2026-11-06

`loadActivation` keeps validated prepared records inside its private pending/
snapshot maps without cloning the same whole catalog between those two internal
containers. A memory hit likewise reuses the private prepared input. Every
external caller still receives a detached records/status copy and a separate
repository. Concurrent consumers, later editable returns and failed activations
cannot mutate another consumer or a retained snapshot. The persistent cache
writer only serializes these internal server records; it never mutates them.
Catalog validation, public `createCatalog` defensive copies, checksum, fresh
status/manifest/count checks, dirty/client checks and all save paths are unchanged.

Same-source Chromium/WebKit comparisons retain identical full catalog hashes.
Cold/restarted initialization removes one whole-array copy; repeat in-session
activation removes two internal whole-array copies while retaining one required
consumer copy. Measured clone CPU was reduced by about22–45ms in these samples,
not seconds of network latency. Do not attribute cold wall-time variation to this
small CPU change. Regression: `test_catalog_cache_activation.cjs` and real IDB
`smoke_catalog_read_cache.py`. Optional `measure_home_entry.py --profile-phases`
records static resources, response-header wait, parse/clone CPU and long tasks;
measurement hooks affect timing and are absent from production.
`--include-invalidated` changes only its disposable local cache signature to
exercise the full-read fallback; it never changes a production manifest.

## Verified reload read-cache ·2026-11-05

Anonymous/public clients may explicitly opt into a disposable committed catalog
snapshot in `mindex.catalog-cache.js`. A SHA-256 connection key scopes it to the
project URL and public connection key without storing the key in plaintext.
Authentication-required connections retain memory-only activation. Every startup
still requires a fresh successful native protocol/ID-format/epoch/manifest/count
response. There is no offline or TTL trust. Matching disk snapshots also require
schema/size/checksum/count/strict-ID-order and full catalog validation before any
adoption. Selected readers, presenter preflight, dirty/client guards and the
atomic save path remain authoritative. Only validated server reads are cached;
forms, editor drafts and recovery journals are never written to this cache.

Cache failure is a miss, not an app failure. Reads are bounded to250ms; writes
are background work with a64MiB cap. Clear/failure generations prevent pending
writes from resurrecting a removed cache. Source changes require a new schema
if their representation/validation cannot safely read old snapshots. The existing
parallel full read and final manifest check remain the uncached fallback.
`test_catalog_cache_activation.cjs` and real Chromium/WebKit
`smoke_catalog_read_cache.py` cover these boundaries. Measure a truly empty
profile separately from a restarted profile with HTTP cache and a matching
snapshot; do not call a warm connection measurement a first-visit improvement.

## Bounded cold catalog reads ·2026-11-05

Catalogs above400 records use three lexical keyset ranges through the existing
read-only RPC: (start, SONG-HYMN-N), (SONG-HYMN-N, SONG-HYMN-T), and
(SONG-HYMN-T, end). The boundary strings cannot be valid IDs. This covers all
supported ID forms, including sparse ranges and legacy IDs; it does not infer
an ID list from counts. Each range has at most one request in flight. Full pages
are validated before boundary overlap is dropped, then ranges concatenate in
order. Exact total count, strict global ID order, catalog validation and fresh
final epoch/manifest checks precede installation. Every worker settles before
failure is exposed, so retries cannot overlap abandoned workers. Small catalogs
retain serial reads. Each range retains same-cursor timeout fallback200→100→25.
The range reader introduces no new API, schema or permission change. The optional
reload read-cache above is a separate transport path. Selected-record reads,
presenter preflight and the existing draft/client guards remain authoritative.
Regression: `test_parallel_catalog.cjs`, existing activation browser suite.

## Home startup read overlap ·2026-11-05

Native catalog reads use the existing server-supported maximum of200 records per
page. SQL timeout57014 reduces the page at the same cursor to100, then25; a
further failure stops. Every record/order/count and final epoch/manifest check
remains mandatory. No new RPC, DB/schema/permission or operational-data change.

At home startup, service-type/list reads may start detached while the full native
catalog is loading. `mindex.service-entry.js` owns a one-use, client-bound receipt;
`app.js` still waits for ID activation before adopting services or projecting any
worship items. Early errors settle immediately, and activation failure/navigation
away discards the receipt. Client changes cannot install a previous response.
Other module startup and explicit presenter freshness reads retain their paths.

The home overview reads service metadata only. Unopened upcoming service bodies
are deferred until the weekly dashboard or a service is entered. Weekly reads
reuse the per-service coalescing loader with at most three workers; loading and
retry states must precede real saved-row rendering. Protected local surfaces,
service collections, forms and presenter transport remain intact.

The home summary starts the lightweight Bible edition query alongside catalog
activation. Its 15-second budget belongs to that request. Praise counts still
wait for activation and use the verified logical catalog, or a separate
15-second budget for the legacy HEAD count. Either result can succeed when the
other fails. Adoption remains bound to the active connection.
Logical group counts, selected readers, drafts, forms, transport and save paths
are preserved. Regression coverage: `test_initial_worship_reads.cjs`,
`smoke_single_song_activation.py`, `smoke_home_startup_budget.py`.

## Verified in-session catalog reuse ·2026-11-05

The native bootstrap still completes and validates the entire catalog before home
or service projection. Within the same client session, a fresh successful
`get_praise_storage_status_v1` response with matching protocol, epoch, manifest and
recordCount can reuse that validated snapshot. This is not an offline/TTL cache.
Concurrent activation reads coalesce; every consumer gets independent records and
a repository. Changed status refetches all pages with the existing bounded timeout
retry and final manifest check. Failure/maintenance clears trust and fails closed.

The initial Praise list can use its installed full catalog after the same fresh
status check instead of rereading every record. Replacement catalog/repository,
client changes, saves or dirty input disqualify this shortcut. Check those guards
again after the status response. Explicit record reads and presenter preflight
remain authoritative; no changes to saves, lyric/form normalization or media state.
Synthetic regression coverage is registered in `smoke_single_song_activation.py`.

## Production checkpoint ·2026-10-25

Native activation completed:1662 records, epoch2, 4-4-4-4. Compatible client
b3b1e61e passed branch40115705179 and main40116326866 attempt2, all four
checks and Pages;12 public files matched. Complete1662-record/11-table readback
matched expected rows, including exact Unicode after a scoped four-document
repair.6751 lyric units and38 audio sets are unchanged.846 element references
and86 source documents migrated;132 affected service revisions advanced once.
Historical payloads and legacy tables remain. The nullable-reference history
comparison repair preserves all other fields and array order strictly.
Transactional native create/save/read/delete passed without retained test data.

Follow-up pending: native catalog initialization must precede home/service
projection. The correction restores today's seven services' linked titles in
local read-only verification. Browser legacy-state migration diagnostics are
still being checked; do not claim complete public UI validation yet.
Private evidence: backups/20261025-id4444/. Another authorized task has saved
since activation: no blind rollback; preserve subsequent changes.

The following is the historical preparation checkpoint, not current phase.

# Single-ID release - 2026-10-25

Status: production preparation and 1662-record staging verified in legacy phase; native cutover has NOT occurred.

The deployed older client is not yet compatible with SONG-HYMN-N001-0001 IDs.
The operator's failed 01 committed the scoped backup, store and worship column;
lifecycle ownership transfer failed because postgres is not a superuser.
Initial operator readback confirmed no writer role, issued_ids or rollout table.
The corrected resume SQL now passed in production, followed by all19 editor-sized
imports and an exact catalog hash check (1662 records, legacy phase, epoch0).
Do not rerun old 01 or use old 02–04. The new resume migration requires this
exact empty partial state and performs lifecycle/rollout in one transaction.
Temporary SET/INHERIT membership and schema CREATE are revoked before commit.
Administrator EXECUTE grant options remain for controlled activation/rollback.

Current mapping: SONG-HYMN-Nnnn-0001 / SONG-HYMN-Tnnn-0001,
SONG-CONT-nnnn-vvvv / SONG-CHLD-nnnn-vvvv. Existing canonical groups
share the CONT/CHLD sequence with distinct final version numbers; no parent
record is introduced. Hymn limits are N001–645 and T001–558. Zero numbers
and overflow are rejected; reserved old candidate numbers are not recycled.
Worship service IDs remain UUIDs: this package only migrates Praise references.

Private package and non-superuser full rehearsal:
`backups/20261025-id4444/`. Latest readback matches the frozen source content.
1662 records, 6751 lyric units, 38 audio sets; reference-only changes affect
86 service rows and 846 elements. Exact full-row rollback, source/catalog drift,
old-client write fencing, private backup denial, ID allocation/variant/delete,
and rollback refusal after native client writes pass in local PostgreSQL18.4.
The full cutover/rollback evidence remains a local rehearsal, separate from
production preparation and staging confirmation.
Final activation requires verified compatible client publication first.


User approved scoped backup and rollback verification before actual migration.
Storage blobs are unchanged. Private evidence is outside version control under
`backups/20261024-single-id-production/`. Never publish snapshots or import SQL.

The rehearsal contains 1,662 records and 6,751 lyric units. Reference changes
affect 86 service rows and 846 element rows; all other captured content compares
exactly. Eleven public tables are captured. Original functions, triggers and
permissions are backed up privately before installation. Final row backups
are captured under locks and drift guards in the cutover transaction.

Exact prepared SQL passed cutover, full row rollback and re-cutover against
isolated PostgreSQL 18.4 with supplied production schema and permissions
(production is 17.6). Separate tests cover native writes and old-client fencing.
Private recovery rows are inaccessible to anonymous clients.

Rollback before native user writes restores original references and legacy
phase; additive schema remains inactive. Native user writes prohibit blind
rollback and require forward recovery. Existing private recovery history is
not rewritten or deleted. Its contents are not copied into local rehearsal.

All required GitHub checks must pass for the combined exact SHA. Publish the
dual-compatible client in legacy phase, then atomically activate the verified
catalog and references. Read back content and exercise only disposable test
records. Keep the release queue ticket through readback.

Native worship requests now freeze the single-song protocol before durable journaling,
including creation/save/deletion of services without praise rows. Existing uncertain
requests remain byte-identical on retry; no transport-time payload mutation occurs.

## Imported empty-record deletion compatibility ·2026-10-25

The lifecycle deletion guard formerly treated imported technical defaults as user
content. The scoped migration ignores only exact default version labels, order 1,
empty lyric signature and the audio-support flag. Imported creation time must
match source provenance and legacy source ID; source count must be 1 and match
provenance; normalized title must equal the current title without spaces and the
source title must be unchanged. Unknown or meaningful fields remain protected.
No fields are stripped or saved before deletion. Existing reference/history,
related-record, CAS, transaction and receipt checks remain byte-identical.
Private source backups and pre/post operational evidence stay outside Git.
The lifecycle PostgreSQL test covers the imported empty shape, meaningful-value
counterexamples, incoming references, CAS, permission attributes and rollback.
Production application and actual cleanup require their separate verification;
a successful local test does not establish either.
