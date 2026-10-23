# MINDEX Current

## Children audio completion · 2026-10-20

Core integration is complete. Bible page numbers and whole-service PNG export
are excluded. Focused presenter view is implemented with isolated Chromium/WebKit
verification; publication status is recorded in deployment receipts. Phone-first remote control
is implemented and locally/relay verified, pending deployment and physical-device checks
(see `docs/presenter-remote-design.md`). Sequence-linked audio/lighting and integrated
video/caption/broadcast remain ideas. See `docs/children-audio-status.md` and `docs/presenter-control-ideas.md`.


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


2026-10-22 작업 중: 원격 코드 v3는 숫자 6자리 서버 claim 방식으로 구현. `migrations/2026-10-22-remote-pin.sql` 운영 DB 적용 성공. v3 클라이언트 배포 검증 진행 중. PostgreSQL 18.4 격리 검증(권한/동시 claim/만료/횟수 제한), Chromium/WebKit UI·실제 adapter 검증 통과. 서버 적용 후 전체 GitHub gate 및 배포 검증 필요.


## 2026-10-22 찬송가 새171–190·연결 통일16판본 검증 대기분

36판본 신규 본절 기록, 전체 구간34판본 확인. 새184·통173 후렴 박 경계는 보류(본절8/아멘2 확인). 새175·통162 본절8.25, 새185·통179 본절·후렴15로 인쇄 악보의 길이를 보존. 누적 본절283/전체1203, 전체 구간279·부분4·자유박자3·수치 미확인917·교차 보류6. 후보 표시286. 가사5419단위 해시·블록·근거 검사 및 Chromium/WebKit36카드·재열기·286 metadata PASS. 운영 쓰기0, 후보 주입 검사이며 미배포. 이전151–170 배치와 함께 배포 대기; 다음191–210. 곡 연결·가사·송폼·메들리·타이밍·예배 불변. 상세 docs/hymn-musical-structure.md 및 docs/hymn-measures-171-190-review-20261022.json.


## 2026-10-22 새191–230·연결 통일31판본 검증 / 미배포

71판본 대조: 신규 수치66, 기존 재확인2, 자유박자1(새230), 보류2(새220·통278). 본절 누적349/1203, 전체 구간345·부분4·자유박자4·수치 미확인850·교차 보류8. 후보 표시353. 가사5419단위 해시·블록·근거 검사, 범위외/보호필드 불변 및 Chromium/WebKit71카드·재열기·353 metadata PASS. 운영 쓰기0; 후보 주입 검사이며 배포·저장 검증 아님. 기존 가사·곡 연결·송폼·메들리·음원 타이밍·실제 예배 미수정. push/main통합/배포 보류 유지. 다음 새231–250 및 연결 통일판. 상세 docs/hymn-measures-191-230-review-20261022.json 및 docs/hymn-musical-structure.md. 격리 작업본 /tmp/mindex-hymn-measures.


## 2026-10-22 새231–250·연결 통일14판본 검토 / 미배포

34판본 중18판본 마디 확정,16판본 경계 박/성부 귀속 추가 대조 보류. 이번 범위 전체 완료 아님. 새244 본절11.5·후렴4.5, 새247 본절17·아멘1. 누적 본절367/1203, 전체 구간363·부분4·자유박자4·수치 미확인832·교차 보류24. 후보 표시371. 5419단위 해시/블록/근거 및 보존 검사, Chromium/WebKit34카드·재열기·후보371 일치 PASS. 운영 쓰기0, 후보 주입 검사이며 배포/저장 검증 아님. 가사·곡 연결·송폼·메들리·음원 타이밍·실제 예배 미수정. push/main통합/배포 계속 보류. 다음 순차 새251–270, 남은 보류 별도 추적. 상세 docs/hymn-measures-231-250-review-20261022.json 및 docs/hymn-musical-structure.md. 격리 작업본 /tmp/mindex-hymn-measures.


## 2026-10-22 새231–250 보류 해소 / 미배포

직전 보류8쌍16판본의 마디 기록·검증 완료. 상세 docs/hymn-measures-231-250-deferrals-20261022.json 및 docs/hymn-musical-structure.md의 최신 절. 누적 본절383/1203(전체 구간379·부분4), 자유박자4, 수치 미확인816, 이전 교차 보류8. 후보387. 5419단위 보존 및 Chromium/WebKit16카드·재열기 PASS. 운영 읽기+후보 주입 검사, 배포/저장 검증 아님. 운영 쓰기0, 기존 가사·연결·송폼·메들리·타이밍·예배 불변. push/main통합/배포 보류 유지. 새231–250 보류0이나 전곡 완료 아님. 이전 보류 새160/통150·새162/통151·새184/통173·새220/통278 별도, 순차 범위는 새251장부터.


## 2026-10-22 찬송가 보류8·새251–290 검증 완료 / 배포 보류

이전 보류8판본 해소 및 새251–290/연결 통일36판본 대조, 총84판본 마디 기록. 누적 전체 구간463·자유박자4·미확인736, 부분0·보류0, 후보 표시467. 전곡 완료 아님. 다음 새291부터 연결판 대조. 5419단위 가사 해시·블록/근거 검사 및 보호 필드 불변 PASS. Chromium/WebKit84카드·재열기/467 metadata PASS(운영 읽기+로컬 후보, 쓰기0). 가사·곡 연결·송폼·메들리·음원 타이밍·실제 예배 보존. push/통합/배포 없음, 배포는 모아서 진행. 상세 docs/hymn-measures-251-290-review-20261022.json 및 docs/hymn-musical-structure.md 마지막 절.


## 2026-10-23 찬송가 새291–330·연결판 검증 / 배포 보류

73판본 검토: 확정69(신규67·기존 새312/통341 재확인2), 보류4(새293/통414, 새298/통35; 붙임줄·후렴 경계 음가 추가 대조). 누적 전체 구간530·자유박자4·미확인669(보류4 포함), 후보534. 전곡 완료 아님. 다음 새331부터 연결판 및 별도 보류4. 5419가사 단위 해시/블록/악보 근거, 보호 필드 불변, Chromium/WebKit73카드·재열기/534 metadata PASS. 운영 읽기+로컬 후보이며 쓰기0, 배포/실제 저장 검증 아님. 기존 가사·곡 연결·송폼·메들리·음원 타이밍·예배 불변. push/통합/배포 없이 계속 모음. 상세 docs/hymn-measures-291-330-review-20261023.json 및 docs/hymn-musical-structure.md 마지막 절. 격리 브랜치 /tmp/mindex-hymn-measures.


## 2026-10-23 찬송가 새331–350·연결판 검증 / 배포 보류

36판본 검토, 확정34(신규30·기존 재확인4), 보류2(새349·통387 음가/블록 배분). 새335 확대 대조로 후렴2+4+2 확정. 누적 전체 구간560·자유박자4·미확인639(보류6 포함), 후보564. 다음 새351부터 연결판; 전체 완료 아님. 5419단위 불변/악보 근거·집계, Chromium/WebKit36카드·재열기/564 metadata PASS. 운영 읽기+로컬 후보, 쓰기0. 가사·곡 연결·송폼·메들리·음원 타이밍·실제 예배 보존. 배포는 모음. 상세 docs/hymn-measures-331-350-review-20261023.json 및 docs/hymn-musical-structure.md. 격리 브랜치 /tmp/mindex-hymn-measures.


## 2026-10-23 찬송가 새351–370·연결판 검증 / 배포 보류

39판본 검토, 신규확정35·보류4(새358/통400·새360/통402 성부/경계 음가 추가 대조). 새354/통394 본절11, 새355/통386 본절14, 새361/통480 후렴 시작 위치 차이 보존, 새367 변박 구간 기록. 누적 전체 구간595·자유박자4·미확인604(보류10 포함), 후보599. 다음 새371부터 연결판; 전체 완료 아님. 5419단위 불변/악보 근거·집계, Chromium/WebKit39카드·재열기/599 metadata PASS. 운영 읽기+로컬 후보, 쓰기0. 가사·곡 연결·송폼·메들리·음원 타이밍·실제 예배 보존. 배포는 모음. 상세 docs/hymn-measures-351-370-review-20261023.json 및 docs/hymn-musical-structure.md. 격리 브랜치 /tmp/mindex-hymn-measures.


## 2026-10-23 남은 찬송가 전체 범위 대조 / 미배포

새371–645·연결 통일판·통일 단독판·이전 보류를 포함한610판본을 검토했다. 수치 기록559(신규555·기존4 재확인), 낭송형 신규2(새634/통70), 기존 낭송형2 유지, 수치 보류47. 누적1203판본 = 전체 구간 수치1150 + 낭송형6 + 보류47. 부분 기록0, 후보 runtime1156. **전곡 수치 검증 완료는 아니며 남은47판본의 근거별 재대조가 필요하다.**

보류는 가사 오류가 아니라 변박·못갖춘·겹친 성부와 실제 저장 블록 경계의 마디 배분 미확정이다. 임의4/8마디를 넣지 않았다. 각 판본의 구체적 이유와 악보 경로·해시는 증빙에 있다. Coda만 있는 통551/553/556의 본절0은 본절이 없는 구조를 뜻하며 미확인값을0으로 채운 것이 아니다.

5419단위 가사 해시·블록 수·마디 합·원본 악보 해시, 보호 필드·범위 밖 기록 불변, 두 작업 경로 일치, 집계 검증 PASS. Chromium/WebKit 마디 필드 버전 전환·변경 감지 회귀검사 PASS. 운영 읽기+로컬 후보로 전체610카드·재열기와1156 metadata를 검사했다. 운영 쓰기·실제 예배 변경 없음. 로컬 검증은 배포 인증이 아니다. 기존 요청대로 push·통합·배포를 모아서 진행한다.

상세: docs/hymn-measures-remaining-review-20261023.json. 개인 증거: backups/20261023-hymn-remaining/. 이전 날짜별 집계는 당시 값이며 최신 집계는 이 기록을 따른다.


## 2026-10-23 보류47판본 재대조 / 미배포

기존 보류47판본의 악보를 다시 확인하고27판본의 마디 수를 기록했다.20판본은 수치 보류를 유지하며 경계·음가 또는 절별 종지 차이를 구체적으로 남겼다. 누적1203 = 수치1177 + 낭송형6 + 보류20. 후보runtime1183, 부분0. **전곡 수치 확정 완료 아님.**

새358/통400은 동시 반주를 별도 박으로 더하지 않아 본절8·후렴8. 새379/통429는 본절16을 새8.5+7.5/통4+4.5+7.5로 기록. 새391/통446 후렴10을 새4+6/통4+4+2로 대응. 새413/통470은 본절13.75·후렴8.25의 공유 마디를 나눴다. 새443은4+4+6, 새467은 본절7+7·후렴8·아멘2, 새617은8+8+4, 새633은 본절7.5·아멘1.5. 통22는5+5+5·아멘1, 통33은 본절4+2+4+2·후렴4·아멘2, 통546은2.25+3.75.

보류 새293·349·360·371·472·482·620·622·635·638와 통37·49·63·72·387·402·414·419·530·550. 새620은1·2절/3절의 대체 종지가 있어 단일 후렴 수치로 일괄 확정하지 않는다. 새638/통550은 성부별 아멘과 기존 블록 대응 미확정. 통72 이전 보류 설명의 신실로하시리다는 잘못된 구절 인용이라 십일조바칩니다로 바로잡았다(실제 가사는 수정하지 않음). 나머지 세부 근거는 receipt의 reviewNote.

5419단위 가사 해시·블록 수·수치 합·악보 해시, 이전 보류47 외 기록 불변과 모든 보호 필드 불변, 두 경로 대장 일치, 집계·diff PASS. Chromium/WebKit 각각47카드·재열기·1183 metadata PASS. 운영 읽기+로컬 후보 검증이며 쓰기0; 실제 저장/배포 검증이 아니다. 가사·곡 연결·송폼·메들리·음원 타이밍·실제 예배 그대로. push·통합·배포는 계속 모음.

증빙: docs/hymn-measures-deferrals-recheck-20261023.json. 개인 원본/검사: backups/20261023-hymn-deferrals/. 이전 기록은 해당 시점의 집계이며 최신값은 이 기록을 따른다.


## 2026-10-23 최종20판본 재대조 / 미배포

기존 보류20판본 전체를 다시 대조하여17판본의 마디 기록을 추가했다. 누적1203판본 = 수치1194 + 낭송형6 + 보류3. 후보runtime1200, 부분0. **전체 수치 확정 완료는 아니며, 보류는 아래3판본만 남는다.**

추가 기록: 새293·349·360·371·472·482·622·635 / 통37·49·63·72·387·402·414·419·530. 못갖춘마디와 종지 음가를 분수로 배분했고, 동시 성부 응답을 별도 마디로 중복 합산하지 않았다. 변박은 각 박자 구간의 마디 수이며 재생 시간 환산값이 아니다. 기존 블록은 재분할하지 않았다.

남은 항목과 필요한 해결 방식:
- 새620: 1·2절과3절 후렴 종지가 분기한다. 단일 후렴 수치 대신 절별 대체 종지 정보를 표현할 공통 데이터 규칙을 먼저 정해야 한다. 현재 단일 배열에 임의의 한 종지를 대표값으로 넣지 않았다.
- 새638·통550: 성부별 아멘 진입이 겹치며 현재 가사 블록과 일대일 대응이 확정되지 않는다. 기준 성부/블록 대응을 명시하는 검토가 필요하다. 기존 아멘 횟수·가사·송폼은 그대로 두었다.

5419단위 가사 해시·블록 수·수치 합·악보 해시 PASS. 이번20 외 기록 불변, 모든 보호 필드 불변, 두 경로 대장 일치, 집계·diff PASS. Chromium/WebKit 각각20카드·재열기·1200 metadata PASS. 운영 읽기+로컬 후보 주입 검증이며 쓰기0; 실제 배포 검증이 아니다. 가사·곡 연결·송폼·메들리·음원 타이밍·실제 예배 변경 없음. push·통합·배포는 계속 모아둔다.

증빙: docs/hymn-measures-final20-review-20261023.json. 개인 근거: backups/20261023-hymn-final20/. 이전 기록은 당시 집계이며 최신값은 이 기록을 따른다.


## 2026-10-23 출력 한 장 기준으로 전환 / 적용·배포 대기

사용자 정정: 정밀한 음가 계산을 중단한다. 송폼/독립 아멘 경계를 유지하며 같은 곡의 슬라이드 분량을 대략 맞추고, 연결 새·통일판도 함께 정리한다. 긴 글은 같은 슬라이드 내 두 줄 배치 또는 자연스러운 구절에서 더 짧은 장으로 나눈다.

수정 후보293판본·1123가사 단위. 연결247곡을 함께 확인했고, 같은 가사의 대응 단위524개는 화면 경계를 맞췄다. 긴 한 줄71단위를 두 줄로 배치. 새622 본절3개는 실제 네 줄 넘침을 발견해2줄씩 별도 슬라이드(약5/4마디)로 분리. Coda/Amen·문구·ID·종류·순서 보존. 새/통일 문구 차이를 덮어쓰지 않는다.

Chromium/WebKit 각각293판본·기존 예배참조141개 출력 내용/순서 보존 PASS. 고유 슬라이드3201개×1920/1280/960 너비=각9603회 렌더, 넘침0. 기존9테이블에서 예정한 가사 줄/장 나눔 외 변화 없음. 운영 쓰기0. 마디 표시 코드는 절 총합/소수 대신 슬라이드당 정수 근사치와 독립 아멘 표기로 수정.

**후보를 만든 것이며 운영 DB에는 아직 미적용, 배포도 하지 않았다.** 현재 공개 대장/runtime은 운영 가사 해시와의 연결을 유지하도록 그대로 두었다. 정수·새 경계 대장은 private candidate-ledger.json에 준비. 적용 시 최신 스냅샷 재확인→내용 CAS와 lyric signature 갱신→정확한 readback→대장/집계/runtime 반영→기존 필수 gate/묶음 배포 순서. 운영에 쓰기 전에 가사 동시 변경과 타이밍 재확인 필수. 실제 예배는 수정하지 않는다.

자료: backups/20261023-hymn-slide-balance/{plan,expected,candidate-ledger,visual-preflight}.json 및 read/apply/read_after/finalize_metadata.py. 검증용 개인 자료는 공개 저장소에 올리지 않는다. 공개 요약: docs/hymn-slide-balance-staged-20261023.json.

## 2026-10-23 전곡 슬라이드 분량·새/통일 대응 검증 / 적용·배포 대기

이 기록은 이전293판본·1123단위 후보를 대체한다. 새645+통일558 = 전체1203판본,722곡군(연결 새/통일481곡군)을 대상으로 기존 악보 근거의 근사치와 실제 출력 구절을 비교했다. 최종 수정 후보440판본·1623가사 단위. 동일 가사의 대응 슬라이드 경계 불일치0. 긴 줄은 괄호 구절을 자르지 않고 두 줄로 배치하며, 필요한 부분만 기존 악구에서 슬라이드를 나눈다. 가사 단어·띄어쓰기 경계는 보존하고 줄/빈 줄만 바꾼다.

판본 고유 차이는 강제로 맞추지 않는다: 새125/통125의 추가 아멘, 새163/통160의 도입 할렐루야, 새361/통480의 본절·후렴 구분, 새385/통435의 구절 어순. 새163·166의 첫 절 전용 도입 규칙이 의존하는 줄 경계도 보존했다. Coda592단위와 아멘만 있는602단위(두 집합 중복 포함)는 원문/경계 그대로다. ‘이 세상은 내 집 아니네’의 모든 버전과 사용자 지정 `-의`/빈 줄은 변경하지 않았다.

Chromium/WebKit 각각 전체1203판본과 기존 예배 참조350개의 출력 문구·송폼 순서 검증 PASS. 고유 가사 슬라이드9738개×3해상도(1920×1080,1280×720,960×540), 엔진당29214회 검사에서 화면 넘침0. 검사 중 발견한 새166 도입 반복 및 새645/통558 아멘 분할 후보는 수정 후 전곡 재검사했다. 모든9테이블에서 계획한 unit.text 줄바꿈 외 변경0; ID·종류·순서·곡 연결·송폼·메들리·음원 타이밍·실제 예배는 그대로다. 이는 운영 렌더러를 사용한 메모리 내 후보 검사이며 실제 예배 저장이나 물리 송출 검사가 아니다. 전곡 인쇄 악보를 이번에 새로 육안 대조했다는 뜻도 아니다.

**운영 DB 쓰기0, push/배포 없음.** 공개 대장/runtime은 현재 운영 가사와 맞도록 그대로 둔다. 최신 후보는 `backups/20261023-hymn-slide-final/{plan,expected,candidate-ledger,full-layout,invariants}.json`. 이전 slide-balance 폴더의 적용 스크립트를 그대로 실행하지 말 것. 적용 전에 현재 DB 및 다른 기기의 로컬 타이밍 의존성을 재확인하고, 동시 수정 CAS→signature/readback→대장/runtime 갱신→필수 배포 gate→운영 확인 순서를 따른다. 다른 기기 로컬 타이밍은 이번 snapshot만으로 확인 불가하다. 정밀 마디 수 미확정3판본과 낭송형6판본은 숫자를 억지로 만들지 않았으며 전곡 화면 검사에는 포함했다.

공개 증빙: [전곡 슬라이드 후보 검증](docs/hymn-slide-balance-completion-staged-20261023.json). 전곡 출력 비교와 줄바꿈 후보 준비는 완료; 운영 적용·묶음 배포는 대기다.
