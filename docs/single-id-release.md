# Single-ID release - 2026-10-25

Status: candidate; production cutover and Pages verification pending.

User approved scoped backup and rollback verification before actual migration.
Storage blobs are unchanged. Private evidence is outside version control under
`backups/20261024-single-id-production/`. Never publish snapshots or import SQL.

The rehearsal contains 1,662 records and 6,751 lyric units. Reference changes
affect 85 service rows and 844 element rows; all other captured content compares
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
