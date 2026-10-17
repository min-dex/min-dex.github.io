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


## COG regular chapter original-edition batch ·2026-10-14

Original COG selected-option identity and exact address equality were checked
for every eligible chapter.1125 chapters /29126 rows are completely collated
with publisher electronic text.8103 remaining full-verse textual/punctuation
restorations applied to production; independent full-row read-back matches all
8103 expected rows. Biblia applied the identical batch;35 Python tests pass,
including exact reconstruction through every earlier correction stage.

64 structural chapters are quarantined: combined ranges, split parts, cross-chapter
display relocations, absence markers and Joel/Malachi original numbering. A new
address-aware parser preserves41:6 as chapter41 verse6, separately records split
parts, and retains all1189 original-edition source pages (including Joel4). Earlier
numeric-only candidate reports stay historical and must not approve structural
corrections.46 non-final parser tails were checked as editorial headings; no
canonical continuation was dropped in the eligible chapters; final tails are empty.

Full originals and source bytes remain private. No COGNEW wording substituted,
no Bible/worship rows deleted. Cache renewal retains all earlier verified scopes
and COG GEN1 override. Overall twelve-translation audit is incomplete.


## Canonical KJV baseline replacement · 2026-10-15

User explicitly authorized retiring the uncertain XML baseline when a trustworthy
identified edition is acquired. This supersedes the prior same-printing hold for
KJV replacement only; differences are not all classified as transcription errors.
Pinned CrossWire KJV3.1 repository revision d490be7e34762deb2c76cb2c1306d4808e27890d
(1769 Oxford-derived curated electronic edition) supplies all66 books /1189
chapters /31102 verse bodies, plus138 canonical Psalm/acrostic headings.
Study notes/Strong's/morphology stay outside verse bodies; exact source XML and
config are archived. This is not a guaranteed facsimile of an original printing.

Production transaction preserves ALL31102 original rows and the complete
translation record privately. Independent public-API read-back matches all31102
expected rows and edition metadata exactly. Stable UUIDs/addresses and personal
annotations remain unchanged. Biblia installs identical text and source metadata;
the prior XML-derived package and all earlier receipts remain recoverable.

Local PostgreSQL18.4 verified full backup, transaction rollback, source drift,
replay, future-edit protection and client backup ACL. Biblia37 Python (system3.9
gzip environment) /46 Node tests pass. The6015-check cache release refreshes
all1189 KJV chapters and retains earlier repair scopes. Deployment and live UI
verification are recorded separately in docs/bible-canonical-sources-20261015.json.
Other translations remain separately reviewed; no all-editions error-free claim.


## Canonical SAE source adoption ·2026-10-15

User authorized trustworthy identified source replacement, not continued repair
of an uncertain XML baseline. Entire SAE publisher electronic corpus (original
1993 translation identity, not SAENEW2001; physical printing unspecified) now
provides66 books /1189 chapters /31102 reader rows. All chapter source bytes and
hashes are archived. The address/outer-span parser preserves canonical text
through malformed font closures; all31082 numbered source rows match prior
publisher-body extraction.2568 heading-bearing verses and26 outside speaker
labels are retained, inline speaker/absence notices follow publisher display.
Six covered markers remain inactive in the operational DB;14 absence markers
are explicit. Existing inactive corrupt1SA14:53 stays inactive; no rows deleted.

Production exact read-back verifies all31103 stored rows, including inactive
records, and the entire translation metadata record. Biblia installs the same
source-derived package. Full temporary new-batch originals remain pending
operational QA/retirement. KJV previous local originals were explicitly retired
and receipts compacted; historical reconstruction fixtures are deliberately
retired, while full current-source conformance remains tested.

Biblia37 Python /46 Node tests pass; PostgreSQL18.4 verified whole replacement
backup/rollback/replay/drift/source metadata/client ACL.7107 cache checks pass.
Cache release refreshes all1189 SAE chapters and preserves earlier source/repair
scopes. Live deployment and reading/search/output verification are separate.
See docs/bible-canonical-sources-20261015.json for source metadata and limits.


## Canonical GAE source adoption ·2026-10-15

Full publisher GAE electronic source now supplies all66 books /1189 chapters.
Exact physical printing unspecified; original translation first published1998.
All31088 numbered publisher rows are parsed without font-tail clipping;2429
heading-bearing reader rows are preserved. Twelve explicit covered UI markers
are derived from source ranges and become inactive in the operational DB; the
ACT24:7 absence notice is explicitly grounded in the source. Existing DEU6:18–19
range and earlier1CH21–22 address correction remain; stable verse IDs and notes
are preserved. All31101 stored rows and the complete translation record match
independent production read-back. No source verse body falls back to old XML.

PostgreSQL18.4 tested whole replacement/source metadata backup, rollback, drift,
replay, future edits and client ACL. New cache scope covers all1189 GAE andSAE
chapters, all1189 KJV chapters, and earlier verified scopes (9481 checks).
Production deploy and operational QA remain separately recorded.

KJV obsolete local originals and both private KJV backup tables were permanently
retired after explicit user cleanup and action-time DB confirmation. Compact
hashes/addresses/source identity remain; old reconstruction is deliberately
unsupported. Current pinned-source conformance stays checked.

## COG supplemental texts ·2026-10-16

User authorized matching additional-book reading/output support and direct DB
application. Production now contains9 supplemental COG catalog items/4389 rows,
with all66 original book records and all other translation fields unchanged.
Exact readback matches the source-derived plan. This is an additive supplement,
not certification/replacement of the still-partial COG66-book baseline. COGNEW
was separately collected and remains uninstalled. Source inventory/version and
empty Sirach preface are explicit; no old XML fallback.

Direct SQL Editor execution resolved its query-size limit using checksum-verified
Unicode LZW transport and reconciled the actual legacy18-column book schema,
including NOT NULL division and unique sort order. Real PostgreSQL18.4 validates
full decode/import/rollback, incomplete/tampered upload, drift, replay and private
ACL. Supabase execution enabled RLS on the private staging/metadata-backup table.
Initial failed attempts rolled back fully; no partial public corpus was installed.

Local UI supports edition-aware taxonomy, Esther/Daniel addition links, literal
chapter labels, original verse labels/order and output payload metadata. Scoped
cache refresh covers151 added chapters. Web deployment remains a separate
checkpoint. See docs/bible-supplements-contract-20261016.md and
bible-supplement-readback-20261016.json.


## Authoritative-only Bible library ·2026-10-16

User authorized retiring the old bundle from active loading and using identified
publisher/electronic witnesses. Production exact readback verifies102031 new
COG/COGNEW/SAENEW source-native segments,8 active editions and8 reversible
retirements. The five previously adopted editions retain their records; no old
verse, note or service rows are rewritten. Biblia exposes only source-derived
packages. Explicit retired service editions never silently fallback. See
`docs/bible-authoritative-library-20261016.md` and readback receipt. Web deployment
and browser checks are recorded separately; CEV remains withheld pending154
HTML/number-position investigations.


## Legacy payload purge ·2026-10-16

User explicitly requested a chat-only account of the old bundle and removal of
its remnants. The original archive, whole legacy JSON/XML-derived corpora,
rollback copies, old whole-body receipts and obsolete replay/import tools are
permanently removed locally. Historical sections above describe past states:
original-corpus reconstruction and old backup dependencies no longer apply.
Compact source/hash receipts and reviewed encyclopedia excerpts retain their
named witness and review scope; they do not certify the current publisher text.
All eight official runtime package hashes are unchanged. Publisher HTML and
the separately authoritative CrossWire OSIS source remain valid source evidence.
No personal notes, bookmarks, service documents or lyrics were modified.

Production retains eight inactive legacy/partial editions,253140 verse rows.
Guarded deletion SQL and synthetic PostgreSQL rollback/replay/drift/FK/trigger
tests pass; production permanent deletion is PENDING action-time confirmation.
Do not report those rows or private production backups as deleted. Mindex
clears only reproducible scripture/catalogue caches once; personal storage stays.
See Biblia/reports/legacy-payload-purge-20261016.json and
Mindex/migrations/2026-10-16-bible-legacy-purge.sql.


## Edition history display ·2026-10-16

User authorized operational deployment of the reviewed edition/year display.
A compact disclosure separates documented publication/revision history, the
installed electronic witness, acquisition date and unconfirmed physical printing.
Current eight Bible bodies/metadata and user/service records are unchanged.
NIV2011 and ESV2025 are requested additions, not installed or falsely selectable.
Official API application/access is pending; never expose provider keys in the
frontend or mirror API corpora without the applicable permission. Mindex target
is10 editions including NIV/ESV; Biblia's verified collection remains uncapped.


## Official ASV addition ·2026-10-16

User requested ASV in Mindex in addition to Biblia. Current active operational
catalogue is9, with288645 stored official rows; no edition was displaced.
ASV1901 eBible electronic source supplies66books/1189chapters/31102 numbered
segments, including16 source-authorized empty bodies with separate footnotes.
All native labels/order/bodies/headings agree across official USFM and USFX
exports using independent extractors. This is two-format consistency of one
electronic witness, not independent print certification. No KJV fallback fills
ASV's empty numbered markers. Source hashes and exact full-row readback receipt
are retained; the previous8 editions and personal/service data are unchanged.

DB: guarded additive transaction applied; independent public API readback matches
all31102 full rows and complete translation metadata. Local PostgreSQL18.4
confirmed compressed transport restoration, rollback, replay, future-edit guard
and exact preservation of257543 pre-existing fixture rows. Private transport
parts remain in mindex_maintenance.asv_transport_20261016 pending disposal; this
is new-source staging, not an old-body backup.

UX: source footnotes render separately from copy/output bodies. One-time renewal
targets only the reproducible translation catalogue cache, preserving current
chapter caches, notes and service records. ASV source/year information is added.
Local read/search/copy and source display pass. Deployment status is recorded in
docs/bible-asv-deployment-20261016.json. WEB is Biblia-only. NIV/ESV API access
remains pending accounts/licensed access; this addition does not activate them.

## Compact runtime/presenter fonts deployed · 2026-10-17

Deployed a conservative generated app runtime and common-glyph presenter faces;
source/full fonts remain intact. See docs/code-organization.md for regeneration
and freshness fallback. Local hash, exact glyph, cache, save, startup recovery,
preview fit and output checks pass locally and on the public deployment; exact
verification is recorded in HANDOFF.md. No production worship data was changed.
