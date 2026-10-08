# Worship Integrity Rollout

Status: history table, journaling triggers, slot uniqueness guard and operator-only
restore_revision were applied in production, according to the user’s SQL Editor
results. The operator-provided post-install catalog was verified on 2026-10-08
at 13:59:56 KST. Production smoke tests remain deferred because no approved test
service is available. Do not rerun the full migrations.

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

## Installation reference (new databases only)

The production database already has these additions. The sequence below is for a
new installation, not instructions to replay migrations against production.

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
The subsequent operator results confirm production installation as recorded below.

## Production Rollout / Integration Handoff

On 2026-10-08 the user ran the history-only SQL provided in chat. Their result
shows 207 preserved versions, 121 distinct service IDs and 2384 kB physical history
size at that time. This installed revision_history, remember_revision,
journal_checkpoint, journal_receipt and their two triggers. Historical checkpoint
IDs can include deleted services. Backup availability was requested but not
explicitly confirmed; do not infer it from the successful SQL result.

The user subsequently reported `slot_guard_and_restore_installed` from SQL Editor.
This confirms installation of assert_unique_slots, the extended validate_document,
the preserved validate_document_before_slot_guard and administrator-only
restore_revision using the existing restore_checkpoint validation path. The applied
SQL revokes restore execution from browser roles and mindex_atomic_writer; the
operator-provided post-install catalog confirms those effective ACLs. No existing worship
content was restored or changed as part of this rollout.

Do NOT rerun either full migration in production. Keep code integration separate
from database installation. Installed function definitions, trigger enabled states
and effective ACLs have now been checked from the operator-provided read-only
result. Operational save/retry/conflict/restore tests still require an explicitly
approved test service.

Worktree: /private/tmp/mindex-db-integrity (detached HEAD).
Base: 6ad02ebb. Prepared commits: d2336bb8 followed by 069533ff. At the original
handoff, main integration, push and web deployment had not been performed.
The follow-up initially fetched origin/main at 6ad02ebb. Before integration,
concurrent work advanced local main to 1b9622e8 through 82c15e16 (setlist navigation
and artist hints). Integration merged that main into the integrity worktree,
preserving d2336bb8 → 069533ff → 956c6732 and the concurrent commits. The only
conflict was appended entries in worship-presenter-decisions.md; both entries were
retained and the recovery entry updated to reflect the operator's installation
result. Local main was advanced to integration commit 48d8d173. Push and web
deployment were not performed for the integrity changes.
No other worktrees were modified or cleaned.

Follow-up validation on 2026-10-08: PostgreSQL 17.6 migration tests passed again
using the checked-in migrations, including a new read-only postflight check.
This rerun did not reload the earlier operator export. The new
`migrations/2026-10-08-worship-integrity-postflight.sql` returns function definitions,
owners, security settings, effective execute permissions, trigger enabled states,
and history table privileges/size in a single JSON result. It performs no DDL or
worship writes. In SQL Editor, expect eight function entries and both preservation
triggers enabled (`O`); inspect definitions and owners against the reviewed SQL.
Browser roles must not execute any listed private functions. The writer must not
execute journal/remember/restore functions or access the history table; it needs
execute on the three slot-validator functions. Direct restore_checkpoint remains
operator-only as before. All reported history table permissions should be false.

The direct production catalog connection failed certificate-chain verification
(`SELF_SIGNED_CERT_IN_CHAIN`); no catalog result was retrieved and certificate
verification was not disabled. The user subsequently supplied the SQL Editor
postflight JSON, checked at `2026-10-08T04:59:56.14429+00:00` (13:59:56 KST).
The catalog verification is complete based on that operator-provided result;
this does not establish that direct DB connectivity is fixed.

- All eight expected functions are postgres-owned and set search_path to
  pg_catalog, pg_temp. Each supplied definition_hash matches the MD5 of its
  supplied definition. All eight SQL bodies match the checked-in migration
  bodies after ignoring comments, whitespace and unquoted keyword/identifier
  case. The preserved validator matches the original validator body.
- remember_revision, journal_checkpoint and journal_receipt use SECURITY DEFINER;
  the other five functions use invoker security, as designed.
- anon and authenticated cannot execute any of the eight private functions.
  mindex_atomic_writer can execute only assert_unique_slots, validate_document
  and validate_document_before_slot_guard among these functions. Both restore
  functions and the three journal/history functions deny writer execution.
- preserve_worship_checkpoint is enabled (`O`) BEFORE INSERT OR UPDATE on
  checkpoints; preserve_worship_committed_revision is enabled (`O`) AFTER INSERT
  on receipts. Both point to the expected journaling functions.
- revision_history is postgres-owned, with only the owner in its table ACL.
  SELECT/INSERT/UPDATE/DELETE/TRUNCATE are false for anon, authenticated and
  mindex_atomic_writer. Physical size is 2,449,408 bytes (2,392 KiB); this catalog
  result does not include version/service counts or remaining storage quota.

This was a review of the supplied catalog, not an operational write/restore test.
No production migration, save or restore was executed during verification.
The user confirmed that no approved test service is available, so production
save/retry/conflict/restore smoke testing is deferred. Backup status remains
unconfirmed.

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
backup and authorize a disposable-service operational test when one is available.
The SQL installation stages and operator-provided catalog checks are complete. Restore requires a reviewed diff
and an expected revision, not an automatic overwrite of real worship content.

## Remaining Work

- Source-text/row agreement needs a versioned document contract; deployed clients
  omit optional sourceRecords, so abruptly requiring them would break saving.
- Linked-service writes still use separate transactions/browser-local retries;
  server queue/batch support needs a separate migration and client transition.
- Duplicate input/content-state fields remain pending a compatibility migration.
- Cross-device history browsing/restore UI is not included in this foundation.
