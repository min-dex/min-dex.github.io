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
