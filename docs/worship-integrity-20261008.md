# Worship Integrity Rollout

Status: prepared and tested locally; NOT applied to production.

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
aliases. Installed functions/private checkpoints remain uninspected because
the local DB password is empty. No production SQL has been applied.

## Remaining Work

- Source-text/row agreement needs a versioned document contract; deployed clients
  omit optional sourceRecords, so abruptly requiring them would break saving.
- Linked-service writes still use separate transactions/browser-local retries;
  server queue/batch support needs a separate migration and client transition.
- Duplicate input/content-state fields remain pending a compatibility migration.
- Cross-device history browsing/restore UI is not included in this foundation.
