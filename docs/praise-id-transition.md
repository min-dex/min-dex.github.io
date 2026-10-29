# Praise ID transition tooling

## Scope and status · 2026-10-28

The user approved retiring CHLD IDs in favor of CONT while keeping one identity
system. No separate hidden UUID or title-based merging is introduced. The offline
planner is implemented; production rekey execution is **not implemented or applied**.
Administrator access, issued-ID/counter/history inspection and old-ID compatibility
are prerequisites. Public catalogue maximums cannot authorize allocation.

`tools/praise_id_transition.py` uses only explicit local JSON files. It has no DB,
network, credential loading or SQL execution path. Output is created exclusively
with mode0600 and cannot overwrite source evidence. Do not commit real snapshots.

Input envelope:
- `records`: full current native records, including revisions and content.
- `issuedIds`: complete issued ledger including deleted/reserved IDs.
- `counters`: authoritative allocator values.
- `active`: current worship rows/documents and other live reference surfaces.
- `references`: reviewed `{path:[typed keys/indexes], id:currentExactId}` leaves
  addressing the envelope. Include each migrated primary ID and relationship.
- `preserved`: immutable receipts, history and provenance, retained verbatim.

Plan mode allocates new CONT numbers above the authoritative counter, preserving
existing CHLD number groups and variant suffixes. All previously issued IDs stay
reserved. Every referenced old ID needs explicit path review; unknown occurrences,
ID-bearing object keys and serialized documents stop the planner. Lyrics, audio,
timing content and legacy provenance cannot be rewritten by reference patches.
The tool does not discover the full database schema or certify snapshot consistency.

`plan --snapshot INPUT --output NEW_PLAN` prepares a private candidate.
`verify --snapshot FRESH_INPUT --plan PLAN --output EXPECTED_AFTER` requires an
exact unchanged before snapshot and recomputes the plan before exporting expected
state. `rollback-rehearsal --snapshot AFTER --plan PLAN --output RESTORED` refuses
rollback after any intervening edit. These are offline transformations, not writes.
The preserved history section is not reference-resolved by this tool: an operational
old-ID compatibility layer must be validated before a migration can use the plan.

## Production prerequisites (unfinished)

Inspect actual schema, functions, triggers, private history/checkpoints, pending
journals, receipts and allocator under authorized administrator access. Inventory
all reference surfaces and typed adapters; serialized documents require parsing
and explicit field handling, never text replacement. Preserve historical originals
and introduce verified old-ID resolution for history restore/links. Fence stale
pending writes; never rewrite an already-issued idempotency request.

Implement a narrowly scoped administrator transaction coordinated with existing
atomic worship save locks/CAS and catalogue epoch protections. A sequence of public
per-record saves is not a rekey transaction. Lock and recheck source/ledger/counters,
reserve destinations, update every active reference consistently, retain recovery
material and abort on drift. Rehearse actual PostgreSQL rollback, replay, stale
clients and permissions before application. Required CI/public compatibility gates
remain mandatory for app changes. Independently read back full records and worship
aggregates after application and compare exact protected fields plus actual output.

## Local verification

`python3 tests/test_praise_id_transition.py`: six synthetic tests cover reserved
IDs, variant suffixes, lyric/audio/timing equality, worship UUID preservation,
unknown/serialized references, missing primary references, counter/ledger defects,
capacity, duplicate references, replay, tampering, concurrency and rollback drift.
This is not a PostgreSQL transaction or production preservation certification.

## Compatible client candidate

`previousIds` is a record-owned list of old native IDs. Catalogue lookup resolves
an alias to exactly one current record; aliases never add list rows or merge songs.
Duplicate/canonical-ID collisions are rejected. Old source fields and native
references project to the canonical ID. Editor saves preserve this identity field.
Backend alias read/write guards and transactional rekey remain prerequisites;
this client candidate alone does not authorize operational migration.

## Administrator inspection and local data rehearsal

Administrator SQL access was recovered through native Chrome control; extension
inventory calls still time out. Current allocation/constraint/function metadata
and scoped private references were exported privately. The observed CONT counter
and issued maximum were444; those are time-bound evidence, not an allocation lock.

A local PostgreSQL18.4 rehearsal transformed72 native rows (60 identities plus12
relation-only rows),3 service documents,12 elements,16 historical aggregates,
3 checkpoints and53 saved state entries, then reversed every transformation exactly.
One further state entry referenced only a previously deleted identity outside this
mapping and was deliberately not resurrected. Native content remained exactly equal.
The strict adapter also verifies adjacent source-ID lines, typed references, original
nested JSON serialization and rejection of unknown fields/invalid mappings.

This tests the reference adapter only. The production executor, monotonic-revision
rollback, restore-function integration, old-client write fencing, compatible release
and independent operational readback are still unfinished. No operational ID was
changed and no production migration/helper SQL was installed.

## Transaction/recovery candidate · later 2026-10-28

`2026-10-28-praise-id-transition-candidate.sql` now implements administrator-only
apply and recovery candidates. Apply compares the complete snapshot fingerprint
under the existing writer locks, refuses issued destination groups, preserves
variant suffix/group identity, and changes native references through the existing
atomic service CAS save. It compares the resulting service/sections/elements/slides
before accepting the transaction. Saved state keys/serialized values use the strict
adapter; pending requests and key collisions abort. Private job receipts retain
before/after snapshots. Recovery refuses intervening edits, advances all revisions,
keeps newly issued numbers reserved and maintains reverse aliases.

`tests/test_praise_id_transition_store.mjs` passed on isolated PostgreSQL18.4 using
actual repository atomic-save migrations: partial failure rollback, snapshot CAS,
body/form/timing/state preservation, replay, recovery drift rejection, monotonic
recovery and denial to anon. This is synthetic coverage, not production readback.

`tools/build_praise_id_compatibility.py` generates guarded replacements from explicit
administrator function exports. It checks exact old definitions before replacing
them, retaining existing ownership/ACLs. Candidates cover old-ID reads, immutable
aliases on content saves, checkpoint resolution, historical-use guards, stale
worship/state writes and retirement of new CHLD creation. An isolated rehearsal
using exported operational function definitions passed alias/dedup, stale worship
writes, retired prefix, history references and helper isolation.

Still required before production: complete current-schema rehearsal including
operational document-preservation triggers and derived document signatures,
compatibility publication/required gate, fresh locked preflight, actual apply and
independent full preservation/public-app verification. **Production SQL installation
and ID writes remain zero.** Candidate files are not evidence of application.


## Emergency compatibility rollback · 2026-10-28

The installed alias calls in the invoker protocol/checkpoint functions were
incompatible with the existing atomic writer: that role has no usage on the
private single-song schema. This caused normal worship saves to fail with
`permission denied for schema mindex_single_song`. Both functions were restored
to their exact pre-install definitions without changing owners, grants or user
data. The migration apply function is now fail-closed with
`REKEY_MIGRATION_HELD_FOR_COMPATIBILITY_REPAIR`; no ID migration may run.

An isolated actual-role test reproduced the error and passed after restoration.
Independent public readback matched all1656 records and5 full service aggregates
exactly. The administrator could not SET ROLE to the atomic writer in production;
no role membership was added and no user worship save was used as a probe.
The SQL generator now rejects the incompatible caller privileges before editing
functions. This is an installation stop, not a completed alias adapter or a
reason to broaden schema/table grants. A reviewed least-privilege adapter and
fresh resource/stability assessment remain prerequisites for the transition.

Production save RPC non-writing probe passed through the actual atomic-writer
role to the expected INVALID_PROTOCOL rejection. No service ID or content was
supplied; the transaction was rolled back. This verifies the repaired privilege
boundary, not a real user save or completion of the ID transition.
