# Worship Integrity Rollout

Status: history table and journaling triggers applied by the operator; slot guard
and restore_revision installation are NOT yet confirmed. See partial rollout below.

## Scope

- `2026-10-08-worship-revision-history.sql` seeds existing checkpoints/current
  aggregates and journals checkpoints and successful receipts in the same
  transaction. Browser roles and the atomic writer cannot rewrite the private
  history. Exact retries add nothing; journal failure rolls back the save.
- `2026-10-08-worship-slot-uniqueness.sql` extends the installed validator without
  replacing its checks or function identity. Nonempty slots must be unique per
  service. Empty content still owns its slot; final-state swaps remain valid.
- Neither migration changes worship content. Duplicate existing slots stop
  installation for an explicit repair, never automatic deletion.

## Apply

1. Run the read-only `2026-10-08-worship-integrity-preflight.sql`. Compare installed
   function definitions, ACL/owners, checkpoint shape and triggers with the
   reviewed protocol. Confirm no duplicate slots, enough capacity and a usable backup.
2. Apply history, then uniqueness during a quiet interval. Both are transactional,
   one-time installations with a five-second lock timeout.
3. Verify SQL hashes and browser/private ACLs. Operational save/retry/conflict
   checks must use an explicitly authorized disposable service, not real worship.
4. Monitor `pg_total_relation_size('mindex_atomic.revision_history')`. No automatic
   pruning is included. Agree retention/export before growth threatens quota;
   do not silently delete recovery data. Preflight sizes exclude future growth.

## Recover

An operator can inspect private `service_id,revision,captured_at,aggregate`.
`mindex_atomic.restore_revision(req)` accepts `protocolVersion`, `serviceId`,
`requestId`, `expectedRevision`, `checkpointRevision`, `confirmRestore`.
Revisions are strings. Review a diff first. It selects server-held history and
delegates to guarded checkpoint recovery, advancing rather than rewinding the
current revision. Reuse identical request IDs/payloads for retries. Stale or
missing versions, invalid references and missing confirmation fail atomically.
There is no public history/restore endpoint or client-supplied replacement data.
Snapshots cannot reconstruct versions already lost, external media bytes, or
canonical song changes not embedded in the saved aggregate.

## Verification

`tests/test_worship_atomic_migration.mjs` runs PostgreSQL 17.6 with the original
production migration/cutover and both additions. Covers seeding, more than three
revisions, private ACLs, slot collision rollback, swaps, retries/conflicts,
injected journal failure, deletion and older-version recovery after deletion.
Failed recovery preserves its checkpoint.

Read-only production scan on 2026-10-08: no duplicate slots or conflicting slot
aliases. The operator returned the SQL Editor preflight: database 343 MB,
119 service aggregates (5,270,425 payload bytes), 88 checkpoints (938,625
payload bytes), no duplicate slots and no existing checkpoint/receipt triggers.
Six inspected private functions are postgres-owned, invoker-security and have
no browser execute grants. Their exported definitions were loaded into the
disposable PostgreSQL 17.6 cluster via WORSHIP_PREFLIGHT_JSON; the full migration
test passed against those definitions as well. Payload sizes are not physical
table sizes or evidence of remaining quota. Backup confirmation is pending.
The subsequent operator screenshot confirms partial production installation below.

## Partial Rollout / Integration Handoff

On 2026-10-08 the user ran the history-only SQL provided in chat. Their result
shows 207 preserved versions, 121 distinct service IDs and 2384 kB physical history
size. This installs revision_history, remember_revision, journal_checkpoint,
journal_receipt and their two triggers, but NOT restore_revision. Historical
checkpoint IDs can include deleted services. Backup availability was requested
but not explicitly confirmed; do not infer it from the successful SQL result.

Do NOT rerun the full revision-history migration in production: its CREATE TABLE
and functions already exist. Install only its remaining restore_revision function
and REVOKE in a transaction after inspecting current catalog state. The slot
uniqueness migration was supplied next in a copyable code block; its execution
result is still pending. Confirm before running it again. Never run both full
migration files blindly against this partially installed database.

Worktree: /private/tmp/mindex-db-integrity (detached HEAD).
Base: 6ad02ebb. Prepared migration commit: d2336bb8. Integrate that commit first,
then the follow-up test/documentation commit. No main integration, push or web
deployment was performed for these changes. Potential merge conflicts are the
migration test, worship-presenter decision log and Electron packaging plan.
No other worktrees were modified or cleaned.

Verification: PostgreSQL 17.6 migration tests passed with the operator's six
exported production function definitions loaded through WORSHIP_PREFLIGHT_JSON.
Tests cover saves, replay, collision rollback, journal failure, deletion, restore
and browser/private ACLs. No production save/restore smoke test has been run.
Electron repository documentation now matches package.json; desktop packaging,
signing, notarization, update delivery and a new release were NOT tested or run.

Remaining approval/design points: source-text versus element content agreement
requires a versioned contract compatible with compact documents; linked-service
transactions require server/client protocol work; duplicate state fields require
a compatibility migration. None of these three has been implemented here and
none should be advertised as solved by history or slot uniqueness. Confirm
backup, complete the pending SQL stages, inspect installed ACLs/triggers, then
authorize a disposable-service operational test. Restore requires a reviewed diff
and an expected revision, not an automatic overwrite of real worship content.

## Remaining Work

- Source-text/row agreement needs a versioned document contract; deployed clients
  omit optional sourceRecords, so abruptly requiring them would break saving.
- Linked-service writes still use separate transactions/browser-local retries;
  server queue/batch support needs a separate migration and client transition.
- Duplicate input/content-state fields remain pending a compatibility migration.
- Cross-device history browsing/restore UI is not included in this foundation.
