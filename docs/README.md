# Mindex Documentation Map

Read `HANDOFF.md` first, then open the smallest current document for the task.
When documents disagree, use the current contract or decision log and update the
stale document in the same change.

## Current Contracts

- `citation-live-output.md`: dedicated live scripture input, optional immediate
  output, draft retention, and controller scroll anchoring.
- `worship-presenter-decisions.md`: current Worship/Presenter behavior,
  service-specific rules, visual output decisions, and live-operation
  conventions.
- `worship-data-contract.md`: Supabase-backed Worship schema, persisted data
  contracts, service type IDs, input modes, and default materialization rules.
- `worship-persistence-current.md`: current persistence path, atomic-save
  boundary, and client fallback policy.
- `thread-worship-presenter.md`: implementation workflow for Worship and
  Presenter changes.
- `design-system.md`: app UI design tokens, button grammar, and design
  migration rules.
- `ui-contracts.md`: app shell and UI interaction contracts.
- `code-organization.md`: runtime script order, code ownership boundaries, and
  safe-refactoring rules.
- `friday-prayer-music.md`: Friday prayer music behavior and button-state
  contract.
- `section-editor-labels.md`: section label editing and preservation behavior.
- `version-name-preservation.md`: explicit Praise version names are user data
  and must survive normalization and saves.
- `young-adult-bulletin.md`: current bulletin editor, DB content/layout storage,
  published snapshots and printing.

## Operational Runbooks

- `manuals/operations.md`: operator-facing Worship and Presenter procedure.
- `monitor-operations.md`: read-only operations panel and access boundaries.
- `supabase-capacity-maintenance.md`: conservative database capacity checks and
  cleanup procedure.
- `lyrics-validation.md`: lyric audit, repair classification, and production
  read-back verification.

## Planning Or Deferred Work

- `electron-packaging-plan.md`: packaging and auto-update plan.
- `admin-access-security.md`: admin and access-control planning.
- `solid-refactor-notes.md`: refactor notes only. Do not treat as a required
  migration plan unless the user asks to resume it.

## Data Review Evidence

- `handoff-worship-service-list-payload.md`: UX->Data handoff for the light service
  list read and the Data thread response (view, source_ref guard, history size).
- `design-worship-service-history-storage.md`: design only (not applied) for the size of
  `mindexServiceDocumentHistory`: slim entries first, separate table only if needed.
- `ux-audit-2026-09-18.md`: bounded UX/code/documentation audit, regression
  coverage, preserved recovery data, and unverified production boundaries.
- `full-hymn-audit-2026-08-19.md`: full hymn dataset audit evidence.
- `hymn-reference-audit-2026-08-19.md`: read-only hymn audit and verified
  repair record. Use only as data review evidence, not as app behavior.
- `identical-hymn-lyrics-2026-08-19.md`: duplicate lyric comparison evidence.
- `worship-slot-key-audit-2026-08-26.md`: read-only Worship slotKey adapter
  audit and migration-risk review before adding DB slot constraints.
- `young-adult-bulletin-archive-review.md`: historical bulletin source review.
- `young-adult-bulletin-weekly-comparison-20260926.md`: dated bulletin content
  comparison evidence.

## Atomic Save Rollout Evidence

These files document a completed safety-sensitive rollout. Use the current
persistence and data contracts for normal changes; consult this group for
deployment, privilege, dependency, or recovery evidence.

- `worship-atomic-save-design.md`: design and invariants.
- `worship-atomic-client-release.md`: client preparation record.
- `worship-atomic-rollout-20260922.md`: production rollout record.
- `worship-atomic-canonical-check.md`: external dependency revision check.
- `worship-atomic-security-check.md`: privilege-boundary verification.
- `worship-atomic-live-audit-20260919.md`: live read-only audit.
- `worship-atomic-recovery-check.md`: recovery verification.
- `worship-atomic-preflight.sql`: operator-reviewed preflight queries; never run
  automatically.

## Retired Notes

Temporary incident logs and old worship-order drafts are not kept as active
documentation. Use Git history if you need to inspect them. Current behavior
must come from the contract documents above.

## Cleanup Rule

If a user-facing behavior changes, update the current decision log or data
contract with the same commit. Do not restore retired drafts or incident logs
as behavior sources.

Do not delete dated audit, rollout, or recovery evidence merely because no code
links to it. Delete a document only after its unique decisions and recovery
value are either obsolete by user intent or preserved in a newer canonical
record.

Completed one-time hymn repair tools and their dedicated tests were retired on
2026-09-22 after read-only production postcondition checks. See the hymn audit
records above for the retained repair evidence and Git reference.
