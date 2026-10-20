# MINDEX Current

## Children audio completion · 2026-10-20

Core integration is complete. Bible page numbers and whole-service PNG export
are excluded. Focused presenter view is implemented with isolated Chromium/WebKit
verification; publication status is recorded in deployment receipts. Remote control,
sequence-linked audio/lighting and integrated video/caption/broadcast remain ideas. See `docs/children-audio-status.md` and `docs/presenter-control-ideas.md`.


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

### Children version audio - 2026-10-17

User-approved audio_set schema and38-song import committed in production DB.
28 existing versions/lyrics preserved;10 children audio versions added, including
one new song.30 automatic sets and8 disabled review drafts.
All38 Storage files re-downloaded and SHA-256 matched (229,417,423bytes).
Private evidence: original checkout output/elem-audio-refresh/version-linkage/.
Chromium/WebKit rendered38 complete sets and checked cues/fingerprints/four
inactive modes; latest live-output/replay regression passes. Deployment pending
required Linux gate and production-byte verification.


## Controller rhythm and button feedback ·2026-10-17

Shared utility buttons now have transparent rest/visible field hover, with10px
text inset and5px icon gaps. Primary hover retains its intent with an inset ring.
Live scripture removes excess checkbox-row centering space and uses20px heading,
10px spacing and35px field; controller toolbar heights align at35px.
Offline Chromium/WebKit checks cover both themes, narrow composer, button hover,
text contrast and keyboard focus; shared editor surfaces and praise row layouts
are checked separately. Output/print/data are untouched. See design-system.md.


## Worship disclosure feedback ·2026-10-18

Authoring panel and per-item settings summaries now share visible field hover
and2px inset keyboard focus. Settings metadata drops invisible pill backgrounds
and padding, retaining5px text gaps. Offline real-editor smoke covers both themes,
Chromium/WebKit,1440/760/640px, Enter/Space, hover/focus and bounds. No output,
print, persistence or operational-data changes.

## Independent worship photo timing · 2026-10-18

Prepared in an isolated branch: absolute photo cues in worship audioTiming.photos,
separate from stored lyric starts and fingerprints. Projection merges events while
preserving lyric display times, blank/photo-only rendering and manual-sync release.
User assets and production application are pending; local validation is distinct
from Linux CI, deployment, and actual-photo full playback.

Local validation:16 unit +17 smoke entry points passed; additional 21-photo/19-lyric
clock sampling passed. Production deployment and actual-user-photo playback remain pending.


## Fresh output after explicit stop ·2026-10-18

Stop clears prior selection/PPT progress and resets to preparation; newly selected
slides still launch explicitly. Pending start-at-slide requests cannot reopen
a stopped output. No music-policy or operational-data change. Offline popup
smoke covers both engines, actual close/reopen and delayed launch cancellation.


## Output session isolation ·2026-10-18

Native output-window close now uses the explicit stop/reset path. Transient
disconnect preserves the Window and position; reload can reattach. New output
sessions reject old control/heartbeat/disconnect/draft/close messages. See the
worship presenter decision log and smoke_output_session_isolation.py.

## 2026-10-18 — 어린이 제목 P 재생과 예배 입력 정리

- 송출 중 어린이 음원 제목에서 P (한글 배열 KeyP 포함)로 기존 자동 넘김 재생 경로를 호출한다. 컨트롤러와 출력 창 모두 지원하며 오디오는 컨트롤러에서만 재생한다.
- 입력창·대화상자·IME 조합·수정키·키 반복은 제외한다. 이미 재생/준비 중이면 재시작하지 않는다. 출력 창 요청은 현재 예배·슬라이드 인덱스·타이밍 그룹이 일치해야 한다.
- 예배 편집의 어린이 입력 영역은 반복 설명/음원 관리 제목을 없애고 미리 듣기·파일명·P 안내·타이밍 작업을 한 줄에 배치한다. 좁은 화면에서는 줄바꿈한다. 타이밍 편집 대화상자와 DB 저장 계약은 유지한다.

## 2026-10-18 — 자동 넘김 복귀와 박자 맞춤 편집

- 어린이 음원 송출에서 R 또는 음원 위치 아래 `자동 넘김 복귀 · R`로 수동 전환 때문에 해제된 자동 넘김을 복구한다. 현재 음원 시각의 가사/간주로 맞추며 audio.load/play/seek 없이 이어 간다. 전주 중에는 동일 구간의 제목으로 복귀한다.
- 현재 송출 예배·음원·타이밍 그룹만 허용한다. 다른 예배/음원, 정지/준비 중, 안전 빈 화면, 실시간 성경 송출, 입력/대화상자/IME/수정키/키 반복에서는 복귀하지 않는다. 삽입 미디어 경계와 최신 출력 세션 검증을 유지한다.
- 음원·타이밍 편집창에 박자 분석, BPM(40–240)과 기준 박 수동 지정, 새 기록의 박자 맞춤, 각 장 ±0.2초 조정을 제공한다. 직접 입력/미세 조정/기존 저장 시각/사진 별도 시각은 자동으로 박에 붙이지 않는다. 가사 1초 선행 표시는 기존 송출 단계에서 한 번만 적용한다.
- 분석은 사용자가 요청할 때 이 기기에서 오디오를 8kHz로 디코딩하고 Worker에서 10ms 간격의 spectral flux·자기상관·전체 구간의 위상 일관성을 확인한다. 대략 60–190 BPM 후보를 찾으며, 무음·불규칙 박자·템포 변화·확신이 낮은 결과에서는 중단한다. 주기와 위상을 곡 전체에 맞춰 미세 탐색하여 정수 BPM 반올림 누적 오차를 피한다.
- 결과는 음악적 정답/가사 시작 시각이 아닌 편집 보조 후보다. 분석 후에도 맞춤은 꺼져 있으며 사용자가 확인해 켠다. 기준 박은 듣고 수동 조정할 수 있다. 분석은 100MB·10분 이하로 제한한다. 음원 교체/대화상자 닫기/수동 기준 편집 이후의 오래된 분석 응답은 적용하지 않는다.
- 박자 설정은 현재 편집 세션의 보조값이며 저장 버튼으로 기록된 시각만 기존 version audio_set/예배 audioTiming 경로에 저장한다. 운영 38곡을 자동 수정하거나 별도 DB/Notion을 만들지 않는다. 원본 음원·가사·폼·사진과 CAS/atomic 저장 규칙을 유지한다.

## Fullscreen close stabilization · 2026-10-18

Browser output stop now waits for pending fullscreen entry/exit before closing;
duplicate requests coalesce. Timing/data and desktop close remain unchanged.
See presenter decisions and test_output_fullscreen_close.cjs. Local rapid-stop
and session-isolation browser checks pass; deployment is verified separately.


## Department assignee linkage · 2026-10-18

Four calendar prayer fields now share atomic saves with children/youth/young-adult
worship elements. Teacher honorific is 교사. See worship-data-contract.md for
field scope, retry/conflict behavior and duplicate-service restrictions.
Production verification and deployment receipts are recorded separately.

## Praise and bulletin realtime · 2026-10-18

Saved Praise records and bulletin/template revisions now share the existing
cross-device Broadcast transport. Detached reads protect local drafts, playback,
output, printing and input races; the current visible record is reconciled on
wake/reconnect and every minute. See `docs/content-realtime.md` for scope and limits.

## Calendar fields and worship-list realtime · 2026-10-18

All editable calendar fields now update in place. Confirmed worship create/delete
receipts refresh list membership without replacing open editors or aggregates.
See `docs/operations-realtime.md` for guards, retained open deletions and recovery.

## Common settings/reference realtime · 2026-10-18

`docs/content-realtime.md` extends the shared transport to saved service type
settings and reference links. Detached reads preserve drafts, open documents,
playback and scroll. No schema changes or automatic worship rewrites.

## Service summaries and archive realtime · 2026-10-18

See docs/operations-realtime.md. List summaries refresh without replacing open
editors or full documents; archive cards use revision scans and changed-only
reads, retaining leader drafts and rejecting mid-read saves.

## Saved scripture realtime · 2026-10-18

Saved excerpts now share guarded content invalidations and visible-screen
recovery. Bible corpus/chapter caches and existing worship documents stay separate.
See docs/content-realtime.md and tests/smoke_scripture_live.py.


## Realtime scheduling latency · 2026-10-19

Shared scheduler coalesces at80ms and advances deferred reads after focus/media/
dialog exit, retaining all guards and15s failure backoff. No faster recovery polling.
See docs/content-realtime.md and tests/test_live_refresh_scheduler.cjs.
