# MINDEX Current

- Lifecycle: `active`; HQ inventory identity verified on `2026-09-24`.
- Product identity: independent church operations product; not governed by the EX design family.
- Read first: `HANDOFF.md`, then the relevant contract and owner report.
- Scope boundary: ministry operations, worship preparation, presenter, and shared Supabase data.
- Safety: do not change production data, schema, permissions, or deployment without the Data/UX boundary and explicit approval.
- Verification: use the project-required tests and record local, commit, deploy, and operational status separately.
- Design governance: `docs/design-system.md` and `docs/ui-contracts.md` own the current shell and interaction rules. Similarity to another app is not a requirement.
- Next source of truth: workspace `/Users/parkjihun/Code/docs/app-inventory.json` for routing; `HANDOFF.md` and current contracts for behavior.


## Verified Bible repair caches and scripture entry · 2026-10-14

User requested production cache renewal and reading/search/output checks.
The repair display helper now gives only the 976 independently verified chapters
in GAE, SAE, COG and Easy Bible fresh persistent keys. Original persistent cache
values remain recoverable; unrelated chapters and existing KRV suffixes retain
their keys. Matching in-memory chapters are discarded and an open repaired
reader chapter reloads. Public scope evidence contains addresses only:
`docs/bible-cache-repair-scope-20261014.json` (no Bible bodies or backup payloads).

A reproduced entry bug left translations unloaded when navigating from home
to Scripture. The helper preserves the original module entry loader and adds a
coalesced translation load only for Scripture when no translations/read error
exist. Existing original-loader return values and error behavior are retained.

Validation:1959 cache scope checks; actual persistent read/write stale-body
bypass and original retention; entry loader regression; previous bounded-text
fitting test;72 corrected reader/lookup/output-body checks. Read-only browser
QA used production data and real reader, text-search RPC and output renderer;
PSA146:10 is readable/searchable in SAE. COG GEN1:10, Easy EZK16:1 and GAE
1CH22:1 were visible in actual output. Long KRV JER33 text fits at44.2px,
404px text height within the available frame; no production service was saved.
This refresh does not claim completion of all original-edition proofreading.


### COG Genesis 1 follow-up verified · 2026-10-14

User executed the three-row SQL; independent production read-back matches the
complete expected rows for COG GEN1:22,30,31. Biblia applied the same corrections
with a separate chained receipt and retained pre-follow-up compressed original.
No other-edition proofreading completion is implied. The cache release includes
a distinct GEN1 key to bypass both pre-repair and earlier COG restoration caches.
Deployment verification remains separate.


## SAE complete electronic text comparison · 2026-10-14

All1189 SAE publisher chapters compared with31102 local rows. Restored764
punctuation/spacing differences only;19 speaker/absent-verse editorial notices
are recorded separately. Six combined-range markers and14 absence markers are
accounted for. No SAENEW wording imported. This is complete publisher electronic
comparison, not independent print collation or assurance against publisher errors.

Production transaction returned bible_sae_complete_repaired /764 /764. An
independent public API read-back exactly matches every expected full row. Biblia
applied the same correction and31 Python tests pass, including chained exact
original gzip reconstruction. Full DB backups remain private, with client ACL
revoked. Source bytes, per-chapter hashes and decisions are preserved.

The corresponding cache release covers643 SAE chapters, including prior repairs.
Local3181 cache assertions and existing output fitting test pass. Web deployment
and live UI checks remain pending. Overall12-translation audit remains incomplete.


## KJV independently confirmed damage batch ·2026-10-14

Pinned CrossWire1769 official OSIS commitd490be7e provides a second complete
31102-row comparison. Six unambiguous damages agree with both curated sources:
EXO23:17, DEU19:14, JON1:15/4:11, GAL2:20 and HEB12:24. Existing American
spellings and other punctuation remain; do not silently substitute another KJV
printing. Official references can disagree and contain errors themselves.

Guarded SQL passed exact backup, rollback, replay, drift and ACL tests. Production
full-row read-back matches all6 corrected rows; Biblia applied identical updates
with a reconstructible original package.31 Python tests pass. The overall KJV
printing/orthographic comparison remains incomplete. New cache release retains
all prior KRV, SAE, GAE, COG and Easy scopes; only the six new KJV chapters join.
