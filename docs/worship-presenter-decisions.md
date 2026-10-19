## Explicit Deletion In Worship Order Editor (2026-10-14)

- The order editor now records the same template suppression intent as the
  section editor before removing an item. Without it, full-save content
  preservation restored a deliberately removed praise row and collided with
  the remaining medley's renumbered slot.
- Preserve the existing protection for accidentally omitted content. Reused
  slots still remove superseded suppression rows through the existing pipeline.
- Chromium/WebKit regression covers a saved three-song medley, up/down moves,
  deleting the primary, deleting the secondary, singleton unlinking and reload.

## Praise Input Path Audit (2026-10-14)

- Search-result selection and pre-save title resolution are content edits, too:
  preserve all existing slot identities instead of renumbering sibling drafts.
- Expanding a persisted song into an inline medley changes collection structure.
  Mark it structural so the save includes secondary rows, remapped member IDs
  and any removed members in one atomic commit.
- Regression coverage exercises both selection paths and expansion of an
  already persisted UUID row, rather than only creating a medley in a blank slot.

## Content Edits Preserve Praise Slot Identity (2026-10-14)

- A per-element title, form, note or mode edit must not renumber sibling praise
  labels, slot keys or editor positions. Only structural operations normalize
  the slot collection. Previously sibling drafts were renumbered while only one
  row was saved, causing divergent source labels and ambiguous later patches.
- Cover eight existing slots whose labels differ from their persisted order;
  preserve that order and all slot identities through edits, receipts and reload.
  Existing production order inconsistencies require an explicitly approved repair;
  ordinary editing must not silently rewrite them.

## Children Autumn Foreground Contrast (2026-10-14)

- Children services already select the C5 autumn background for September and
  October. Output captures must use `presenterStatePayload`, including its
  background sources, rather than a slide-only payload.
- User approved `#34271F` (RGB 52, 39, 31) after comparing it with the original
  `#594841`, choosing stronger contrast and a warmer autumn appearance.
  This is a deliberate design change, not an original-source color claim.
- Original-source evidence remains `#594841` in `Elem_2026-01-04.pptx`,
  slides 6–7, and `Elem_2026-08-09.pptx`, slides 6–7. The available 2026 archive
  has no October 11 deck.
- Apply the foreground consistently to all frames using the C5 artwork, including
  lyrics, titles, announcements, liturgy, ready/waiting copy, and the transition
  cross (both strokes, including thumbnails), and monochrome church logos.
  Logos use an SVG color filter to preserve the original image and alpha edges.
  Override legacy fixed white text and remove the dark title bar on this light artwork.
- Only scripture reading replaces C5 with a dark background and white text.
  Sermon scripture remains on C5 and inherits the brown foreground. Authored
  community-confession highlight colors are preserved. Chromakey and
  other department/background themes remain unchanged.

## Medley Mode Save Ordering (2026-10-14)

- Production test services exposed a partial-save acknowledgement bug: replacing
  one editor item with its compact database ordinal mixed it with sibling editor
  ordinals (10, 20), reversing medley members on the next template projection.
- Preserve the acknowledged item's editor section/element order while adopting
  saved content. A full reload still rebuilds the entire collection from rows.
  Sibling drafts and concurrent edits retain the existing isolation rules.
- `tests/smoke_medley_mode_save.py` exercises actual atomic save receipts,
  repeated score/lyrics switches and reloads in Chromium/WebKit. The previous
  code fails the member-order assertion; the fix preserves primary/member IDs
  and unique persisted positions.

## Announcement Parenthetical Text (2026-10-10)

- User requested the Vita/Studium parenthesis display behavior for announcements.
- Render paired parentheses and their contents at 80% in announcement output and
  previews. Nested pairs shrink once; unmatched pairs remain normal text.
- Keep authored text, whitespace, emphasis and persisted values unchanged.
- Scope this to announcement body slides, including chromakey output; other
  worship text such as lyrics, scripture and confessions keeps its typography.

## Live Scripture In Right Panel (2026-10-09)

- User approved moving live scripture input immediately above worship order input.
- Keep both inputs expanded and bottom-aligned as one normal-flow group; short panels scroll.
- Retain the static multicolor border, draft/caret, session auto-output setting and atomic save behavior.
- Each citation element keeps its own target. Its board shortcut focuses the corresponding panel input without changing output.
- Adding scripture never automatically scrolls the slide board.

# Worship / Presenter Decision Log

## Keyboard Focus Across Board Refreshes (2026-10-08)

- A full presenter board render preserves a focused thumbnail using the same
  capture/restore helpers as incremental patches. Live navigation restores the
  current output index; unrelated controls do not acquire thumbnail focus.
- A scheduled keyboard focus move is discarded if the module, selected service,
  live service, slide index or blank state has changed, or another control owns
  focus. Preserve focus at the render boundary instead of adding a timed retry.
- Offline Chromium/WebKit coverage in `tests/smoke_presenter_focus.py` uses real
  keyboard events, delayed full renders, control handoff and route changes.
  The main presenter smoke checks the focused index after deferred work and
  retains the current stored-form and `corporatePrayers` contracts.

## RPC-Only Instance Persistence (2026-10-06)
- Removed the temporary protocol switch and all direct-table instance-write fallbacks. Aggregate reads, full/element saves, linked sync, creation, deletion and live leader edits require the RPC client. Read-only list/archive queries and import-source editing remain separate contracts.
- Retain revision checks, project-scoped pending requests, local recovery, and draft isolation. An uncertain request is replayed exactly; its receipt requires reload and cannot acknowledge a newer draft.
- Replaced legacy partial-commit fixtures with RPC safety checks. Chromium/WebKit coverage includes rollback, lost response, linked saves, creation/deletion retries, save queues, conflict review and benediction replacement.
- No production records, grants or schema were changed. Historical document arrays remain readable until their fallback/recovery content is proven equivalent to canonical rows.

## Source Field Preservation (2026-10-15)
- Multiline titles use indented blocks. Announcement welcome/news/footer have separate source fields, without duplicating their text in the title.
- Direct praise exports one `가사 화면` block per screen; blank lines and literal `---` inside a screen remain content. Legacy `가사` blocks still parse.
- Explicit song/version IDs survive catalog hydration gaps; normal save validation remains required. Blank form fields explicitly clear the form.
- Source reapplication must preserve announcement regions, bold markup, manual lyric screens and audio URLs. Regression: `MINDEX_SOURCE_AUDIT_STRICT=1 python3 tests/audit_source_roundtrip.py`.

## Source Input Preservation (2026-10-15)
- Editable source serializes actual content, never a display fallback label for an empty input.
- Restore input modes as metadata rather than invoking praise-only mode conversion; classify asset/text values after restoring the new type/mode.
- Repeated source apply/save must preserve blank scripture, person, media, manual lyrics and text slides. See `source-roundtrip-20261015.md` and `smoke_source_input_roundtrip.py`.

## Source Round-Trip Integrity (2026-10-06)
- Historical reproduction confirms that pre-`a4afef7b` portable parsing omitted `endLine`; the old patch appended the full original source after the replacement. The Oct 2 range fix prevents that growth; retain range validation and repeated-patch tests.
- Source Apply validates record multiplicity before creating or modifying any items. Previously it applied only matched records while retaining the entire duplicate draft. Reject newly introduced duplicates without changing drafts or canonical items.
- Snapshot construction applies the same guard for non-UI save paths. An existing conflicting group may pass only unchanged, so unrelated edits are not blocked. Never guess between differing copies. Real repeated labels retain their canonical item count; a new portable label/section may occur once.
- Regression: `smoke_source_roundtrip_integrity.py` reproduces the historical bug and checks 50 portable/20 legacy patches, idempotence, preflight non-mutation, snapshot protection and legitimate repeated labels in Chromium/WebKit.

## Source Duplicate Maintenance (2026-10-06)
- Follow-up approved by the user: Sep 27 second/third citations restored to Exodus 17:1-7; 15:22-25; Psalm 119:105 in both canonical elements and source. Afternoon citations retain the filled superset including Philippians 4:6-7; reference image source uses the canonical `I must tell Jesus.jpg` display name without changing its URL. Three revision-checked transactions/readbacks are backed up under `backups/source-review-20261006/`. Six other differing groups remain; their contents were not chosen automatically.
- Removed 49 identical source-block groups across six services through document-only aggregate RPC saves. Each group matched exactly one canonical element; differing groups were preserved.
- Backed up the original aggregates and exact revision-checked requests locally under `backups/source-cleanup-20261006/`. Readback verified every section, element and slide row unchanged and exactly one revision increment per service.
- Ten differing groups remain for review: Sep 27 second/third citations; Sep 27 afternoon citations/reference image; Oct 4 youth praise 2; Oct 4 afternoon sermon/benediction; Oct 2 monthly praise 5/reading/sermon. Never choose a source copy solely by position.
- Historical document arrays and disabled non-atomic branches are retained pending equivalence testing. Song title collisions alone are not deletion criteria; the HisShow record is distinct metadata, not an automatic merge candidate.

## Live Citation Save Scope (2026-10-04)
- Element patches serialize only the target while retaining counters from the full order. Unloaded unrelated songs must not block a scripture patch; full saves still validate every element.
- Collapse duplicate source blocks only when their contents and section are identical and exactly one canonical item matches. Ambiguous or differing content remains an error; never regenerate the whole source to hide it.
- Keep the live-input pending guard through persistence, save by stable item ID, and restore the submitted reference on failure without discarding resolved live content.
- Regression: `smoke_citation_patch_scope.py`, `smoke_citation_output_navigation.py`, worship edit sync and Sunday sermon scope. Read-only copies of six Oct 4 services reached mocked commit; no production test writes were performed.

## Liturgical Heading Inset (2026-10-04)
- Fullscreen liturgical body text stays centered against the full stage. Its heading independently retains the former top inset (8cqh position plus 1cqh padding); removing body padding must not pull the heading toward the screen edge.
- Chromakey heading placement is unchanged. Verify title position and body center at full output and thumbnail sizes.

## Image Upload Round Trip (2026-10-04)
- Image selections append in order to one element, including one-file selections and legacy single-image assets. The chooser says image addition rather than implying replacement.
- Stage an image batch before one element save; do not repeatedly save under a transient element ID. Reacquire the current item after asynchronous storage uploads.
- A nonempty image slide list is authoritative even when it contains one page. Keep existing images on upload failure.
- Test the upload handler through persistence row construction and rehydration, including projection refresh, ID assignment, sequential additions and failures (`smoke_image_upload_roundtrip.py`); synthetic rendering alone is insufficient.

## Section Query Schema (2026-10-04)
- Section list queries must match the section table schema; `person` belongs only to elements. Both initial loading and DB refresh use the shared section select.
- Check the actual client select against the schema, not only a separately maintained minimal column list. Regression: `tests/test_worship_section_select.cjs`.

## Save Failure Feedback (2026-10-04)
- Silent element saves suppress success notices, not failure notices. Empty error messages fall back to an error code instead of an object string or unexplained failure.
- Network failures mean the save outcome is unconfirmed, not necessarily rolled back. Preserve pending requests and drafts; do not bypass revision checks or clear recovery state.

## Image Load Failure Recovery (2026-10-04)
- Image preload readiness requires successful decode/load and nonzero natural width. Failed loads never become ready cache entries.
- Retry a transient load failure once; background preloading does not repeatedly retry exhausted failures. Selecting a failed image explicitly starts a fresh bounded attempt and retains the previous output until ready.
- Promote an in-flight low-priority image when selected for output. Keep the same URL and reuse valid cached images.

## Controller Refresh Projection Scope (2026-10-02)
- Controller refreshes and standalone board rendering reuse the existing synchronous service-item scope. A monthly board must not rebuild the same template for each input or thumbnail.
- The scope ends after each render, including exceptions; subsequent edits receive a fresh projection. Persistence, prayer grouping and slide order are unchanged.

## Playback Fallback Is Not An Editable Default (2026-10-02)
- Generic verse/chorus playback expansion must not populate the form input or persist on song linking. Explicit item/template/song defaults still fill an empty form, including the special-hymn default.
- Removed the accidentally materialized form from October 4 first-service offering only, using revision-checked RPC; other content was unchanged.

## Linked Source Integrity (2026-10-02)
- Portable source records must expose an exclusive endLine when includeRanges is requested. Missing ranges must abort updates, never splice the entire original document back into itself.
- Repeated linked saves must preserve record count and unrelated source blocks.
- Scripture reading supplies sermon text; first-service reading is independent, while second/third share reading, sermon and citations. Existing praise/offering sharing is unchanged.
- October 4 first/second service source duplicates were conservatively deduplicated through revision-checked RPCs. All element/section rows were preserved. Divergent offering song forms still require the user's choice, not forced overwrite.

## Live Citation Composer And Scroll (2026-09-18)

- The live scripture composer sits in the right controller panel, immediately above worship order input.
  Its static multicolor border is a reviewed domain-specific distinction, not
  a change to shared EX shell styling.
- `추가 즉시 송출` defaults on for the controller session. Off adds/saves only;
  on navigates output to the first added verse and opens output when needed.
- Neither mode forces the controller to scroll to the new slide. The right panel retains its own scroll position and input draft independently of the slide board. Explicit slide navigation retains existing scrolling.
- See [live citation contract](citation-live-output.md) for failure and draft rules.

## Preparation Input Bottom Alignment (2026-09-18)

- Remove the divider above bulk worship input in the right panel. Keep input
  expanded and bottom-align it within the panel's normal grid flow.
- When the panel is shorter than its content, scroll the panel rather than
  overlaying output controls or shrinking the input. Preserve draft, focus,
  text selection, preview dimensions and input height.

## Preview Header Status Slot (2026-09-18)

- Video health shares a fixed 34px caption slot with the slide title. Loading,
  failure, paused and blocked states temporarily replace the title and retain
  the retry action. Empty/healthy status restores the title without moving
  preview, navigation or input controls; no separate empty 40px row remains.
- Music/help utility containers and the help summary use 34px height; the
  summary is square. Preview dimensions and expanded preparation input remain
  unchanged.

## Output Action Hierarchy (2026-09-16)

- The preview-adjacent right start command is primary while the right panel is
  open. The left start command stays available with neutral emphasis and
  regains accent when the right panel closes. Stop styling, action handlers
  and button dimensions remain unchanged.
- Keep bulk worship input expanded, as explicitly requested by the user.
  Do not introduce a preparation disclosure or automatic collapse. Inline
  examples remain visible only on unoccupied lines; drafts and focus stay put.
- Reuse current tool-group dividers; no additional cards, spacing or decoration.

## Uploaded Media Cache Lifetime (2026-09-13)

- New reference media and audio uploads use a shared 30-day Cache-Control
  lifetime instead of one hour. Uploads retain timestamped paths and
  `upsert: false`; replacing media must create a fresh URL, not overwrite bytes
  at an existing long-lived URL.
- Presenter preloading remains unchanged for live-output reliability.
- This does not update existing Storage objects, clear billed usage, or prove
  the source of historical egress. Browser eviction can still cause downloads.
- Existing-object metadata changes belong to the Data ownership track: audit
  immutable paths and actual response headers first, preserve bytes and URLs,
  and use a supported Storage operation. Do not directly edit storage tables or
  download/re-upload the entire bucket to change cache policy.

## 50px Metadata Typography (2026-09-13)

- Presenter roles at the 1920-stage 50px size use weight 600. Larger fullscreen
  support/liturgical roles retain their prior weights via mode-specific tokens.
- Fin. shares the reading body's font-family token and retains italic styling;
  reading body size/weight and the translation label's family are unchanged.
- Eulyoo1945 is currently a local installed font, not a bundled web font. Safari
  may restrict access to user-installed fonts; CSS family equality alone does
  not guarantee identical glyphs across browsers. No font files were added.

## Document Restore Blanks (2026-09-13)

- While document-slide fallback remains active, restored slides pass through the
  same trailing-blank policy as item-built slides. Existing blanks are retained.
- This does not recreate the fallback in checkouts that have removed it, mutate
  stored snapshots, or change which data source is selected for presentation.

## Automatic Blank Grouping (2026-09-13)

- Controller section grouping uses the originating element's non-automatic slide
  for automatic blanks. Empty output metadata must not split the controller group.
- This applies to all sections, including the shared closing hymn/visual group.
  Output payload, slide order, and persisted worship data are unchanged.

## Blank Group Ownership (2026-09-12)

- Keep sectionRole on generated blanks: the controller uses it to keep praise
  blanks with their originating songs and avoid duplicate editor groups.
- A blank layout is never a preparation slide, regardless of inherited role.
  Ready and closing trailing blanks remain enabled; no DB content is changed.

## Ready And Closing Blanks (2026-09-12)

- Ready screens/videos and closing visuals use the common trailing-blank rule.
  The ready/closing suppression helper is removed. Existing blank slides and
  automatic blanks still do not receive duplicate blanks.
- Generated blanks clear ready metadata as well as visible media/text. Waiting
  video playback itself and persisted worship content are unchanged.

## Welcome Blank And Examples (2026-09-12)

- Praise welcome uses the common trailing-blank rule; it no longer explicitly
  suppresses its blank. Ready and closing-screen behavior is unchanged.
- The first ten bulk-input example lines choose distinct song/hymn examples by
  displayed position, rather than repeating one hymn or cycling three songs.
- These changes do not modify persisted worship content.

## Preparation Examples (2026-09-12)

- Manual praise examples use the persisted input mode even when the editor
  exposes that mode as text. Announcement examples use announcement content.
- Monthly grouped prayers expose one example per prayer. Bulk input updates the
  corresponding corporatePrayers entry, preserving its sibling, sourceElementId,
  and an omitted assignee. No separate prayer elements are created.
- Bulk apply remains an in-memory edit; saving is still a separate action.

## Individual Input Feedback (2026-09-12)

- Right-controller bulk input stays directly visible, including when empty.
  The 2026-09-16 disclosure experiment was reverted at the user's request;
  reducing clutter must not add an extra step to this input workflow.

- The individual editor command is labeled `반영·저장`: it still applies the
  fields and saves to the DB. Quick worship input retains its separate semantics.
- Visible editors show modified, saving, saved, or failed feedback next to the
  command. Feedback updates do not replace input DOM or move focus.
- Save completion compares the captured field values and pending deferred input.
  Later typing remains modified; failure leaves the draft intact. Feedback is
  transient UI state, not persisted worship metadata.
- Individual commit returns the real save result, including false on validation
  or persistence failure. Existing save serialization and synchronization remain.

## Sunday Edit Synchronization (2026-09-12)

- Each service displays and edits its own persisted values. Empty values do not
  borrow sibling content or hide their editor.
- Confirmed edits synchronize after source save: praise 1-3 between Sunday 1/2,
  reading and sermon/citations between 2/3, offering hymn between 1/2/3 on the same date.
- Only existing, unambiguous, standard elements with matching previous content
  participate. Alternative offerings, videos, special songs, custom media, and
  missing template rows are not converted into shared elements.
- Different target content, pending edits, live output, and revision conflicts
  are preserved. Failures are visible; local retry records survive reload.
  Saving the source again retries them without resynchronizing unchanged fields.
- Only target content fields are written, never sibling sections/order. Document
  text/history and that element's slide snapshots are updated while unrelated
  slide snapshots are retained. Multi-row writes are not an atomic transaction.

This is the durable record for behavior that must not be silently reverted by
another task. It supplements the data contract; it records reviewed product
decisions rather than implementation history.

## Update Rule

When a change affects live service operation, templates, output behavior,
default selection, or a user-visible exception:

1. Update this file in the same change.
2. State the rule, its scope, and the exception if one exists.
3. Add or update a focused smoke assertion when the behavior is testable.
4. Do not replace a documented rule with a local workaround or fallback.

If another thread sees a documented rule that appears wrong, it must ask the
user or update this log with the new reviewed rule. Do not silently revert a
documented decision during cleanup, refactor, or smoke-test repair.

Small visual polish that does not alter behavior does not need an entry.

## Current Decisions

- 앱은 로드 시 예배를 자동 삭제하지 않는다(2026-09-20). 예전에는 이번 일요일에 열리지 않는 종류의
  자동 생성 예배를 지웠지만, 테이블 분기가 내용 유무를 확인하지 않아 사용자가 채운 예배도 지울 수 있었다.
  자동 생성은 계속하고, 필요 없어진 예배는 직접 삭제한다.

- 메들리(연결 찬양) 개별 입력은 곡마다 한 줄로 표시하고, 행별 `찬양 n` 머리 라벨을 두지 않는다.
  각 행의 곡 입력값이 이미 곡을 식별하고 범위(`찬양 3–5`)는 요소 헤더에 있다. 설교 제목/본문처럼
  서로 다른 필드를 가진 다중 항목 그룹은 라벨을 유지한다 (2026-09-20).
- 요소 헤더는 라벨과 같은 제목을 두 번 출력하지 않는다(`찬양 1  찬양 1` 방지). 제목 데이터와 모델은
  그대로 두고 표시 단계에서만 생략한다 (2026-09-20).
- 참고 화면 빈 안내와 `가사` 머리글의 대비·정렬을 다듬었다. 라이트 테마 안내 박스는 어두운 미디어
  배경 대신 패널 배경을 쓴다 (2026-09-20).

- 슬라이드 번호 점프 입력에 범위 밖 번호를 넣고 Enter(또는 blur 커밋)하면 송출은 움직이지 않고,
  입력창은 현재 슬라이드 번호(빈 화면이면 `0`)로 되돌아간다 (2026-09-20).

- 부서 예배의 광고는 엘리멘트 label과 새 예배 템플릿 제목 자체를 `광고`로 통일한다.
  기존 청소년부 광고·청년부 광고 label은 로드 시 변환하고 이후 저장도 `광고`로 한다.
  순서 목록, 편집기, 송출도 동일하게 표시한다. 광고 본문과 예배 소속은 변경하지 않는다.
  본문형 광고의 동작은 부서명이 아니라 announcements 섹션과 body 유형으로 판정한다.
  본문형 광고는 고정 `교회소식` 제목 분기를 거치지 않으며, 입력창과 본문 슬라이드를 유지한다.

- 월삭 공동기도는 `공동기도 1·2`, `기도찬양`, `공동기도 3·4`의 세 엘리멘트로 편집한다.
  각 기도 묶음은 두 제목과 두 담당을 corporatePrayers에 함께 저장하고 해당 출력도 소유한다.
  기도찬양의 기존 곡 연결은 그대로 유지한다. 제목만 묶고 담당을 별도 항목으로 남기지 않는다.
  기존 개별 기도는 번호와 섹션이 유일하게 확인되는 경우만 묶음으로 가져온다.
  중복 후보, 제목 충돌, 미디어나 별도 본문이 있는 항목은 자동 병합하지 않는다.
  기존 DB 행은 일괄 삭제하지 않는다. 묶음이 저장한 sourceElementId로 이미 포함된
  레거시 행을 식별하여 다시 엘리멘트로 추가하지 않는다.

- 인용 구절은 크로마키와 풀스크린 모두 성경 책 전체 이름을 표시한다 (2026-09-12 수정).
  크로마키 인용 구절은 흰색 탭에 출처, 전체 폭 남색 바에 본문만 표시한다.
  흰색 탭 너비는 출처 텍스트와 좌우 여백 및 오른쪽 사선 길이에 맞춘다.
  풀스크린과 성경봉독 레이아웃은 변경하지 않는다.
  섬네일과 실제 송출은 동일한 규칙을 사용하며 저장된 말씀 입력값은 변경하지 않는다.

- 찬양 로딩 완료 시 promise 해제 후 로딩 표시를 갱신한다.
- 찬양 버전·가사 테이블은 독립적으로 병렬 조회하되 둘 다 성공해야 곡에 반영한다.
  가사 검색과 Presenter가 전체 가사를 사용하므로 목록 최적화를 이유로 가사를 생략하지 않는다.
- 연결 곡·가사와 예배 상세 묶음 조회는 80개씩 제한된 병렬 요청을 사용한다.
  모든 페이지를 수집하고, 실패한 묶음은 진행 중 요청이 끝난 뒤 오류/캐시 경로로 처리한다.
  섹션→엘리먼트, 버전→가사의 의존 순서는 유지한다.
- 역대 콘티 화면에서 사용하지 않는 곡 매칭 수 계산은 하지 않는다.
  예배 목록의 source_ref와 복구 스냅샷은 보존한다. 이를 축소하거나 오래된 캐시로
  먼저 표시하는 최적화는 편집·복구·자동 예배 생성의 최신성 검증 없이 적용하지 않는다.

- 전역 담당 표기는 `담당`, 유형명은 `제목 / 담당`으로 통일한다. 옛 명칭의
  레거시 별칭은 DB 전수 검사 후 제거했다. 상세 규칙은 `docs/ui-contracts.md`의 Assignee Terminology를 따른다.

### Setlist Archive Navigation

- 2026-10-10: 주별 보기는 실제 저장된 예배 또는 가져온 예배 기록이 있을 때만 표시한다.
  2026-09-09의 빈 주·부서별 고정 자리 생성 결정을 대체한다. 날짜나 콘티 작성 여부로 숨기지 않으며, 실제 등록된 미래 예배도 유지한다.
  실제 예배의 빈 콘티는 콘티 미등록으로 표시하고, 예배 자체가 없는 기록 없음 카드는 생성하지 않는다.
  집회 없음은 명시된 DB 근거만 사용한다. 온세대·연합예배로 함께 드린 부서도 `집회 없음` + 사유로 통일한다. 온세대 주는 별도 콘티 없는 어린이부·청소년부의 사유를 `온세대 찬양예배`로 표시하며 실제 기록을 우선한다.
  원문으로 확인한 2/20 문화예배, 4/5 청소년부·청년부 통합 사유는 import source의 `raw_payload.service.weekly_status/weekly_reason`에 보관한다.
  수요예배 등 자료가 없는 과거 주는 휴회로 추정하지 않는다. 검색 중에는 일치하는 카드만 보여주며 빈칸을 생성하지 않는다.
  금요일 월삭예배는 금요 자리에 표시하며, 1·2부 개별 카드는 만들지 않는다.

- 별명은 카드 첫 줄 오른쪽에 정렬한다. 주별은 예배명, 예배별은 날짜 옆에 표시한다.
- 2026-01-04~05-31 주일 콘티 17건의 `나는 예배자입니다 + 소원`을 DB에서
  `입례찬양`/`entrance_praise`로 정정했다. 메인 번호에서 제외하며 원본 백업은
  `backups/setlist-sunday-entrance-before-20260906.json`에 보관한다.

- 1부 설교자를 예배 인도자 기본값으로 자동 대입하던 예외는 제거한다.

- 주일 콘티는 3부 기준 `주일예배` 카드 하나만 표시한다. 같은 날짜 2부 특송만
  3부 특송 앞에 합치며, 기존 콘티에 2부 특송이 있으면 추가하지 않는다.
  1·2부 별도 카드는 표시하지 않고 예배 DB 원본은 유지한다.

- 콘티 카드에 예배 별명을 표시하고 검색에도 포함한다. 실제 예배의 `service_alias`와
  import 콘티의 service tags를 사용하며 비어 있으면 별명 줄을 만들지 않는다.
  메인 찬양 번호는 행 수가 아니라 곡 수로 센다. `A + B`는 `찬양 1–2`,
  다음 `C + D + E`는 `찬양 3–5`이며 이후 단일 곡은 `찬양 6`이다.
- 역대 콘티는 기존 import 콘티와 실제 Worship 예배를 함께 표시한다. 실제 예배는
  저장된 praise 항목에 곡 ID 또는 제목이 있을 때만 카드를 만들고 빈 순서는 제외한다.
  section/element 순서와 찬양 인도자를 사용한다. 가사·슬라이드는 조회하지 않는다.
  같은 날짜·예배 유형의 import 콘티가 있으면 기존 콘티를 우선해 중복 카드를 만들지 않는다.
  1·2·3부는 서로 다른 예배로 취급한다. 실제 예배 자료는 복사 저장하지 않고 조회해서 구성하며,
  콘티를 다시 열거나 새로고침하면 변경된 예배 내용이 반영된다. 직접 입력한 곡명은 임의 매칭하지 않는다.
- 청소년부의 서로 다른 날짜에 반복된 콘티는 각각 유지한다. 2026-09-06 원문 대조로
  같은 날짜 중복 7개를 제거하고 22개 날짜를 보존했다. 원문의 `결단(07)`에 따라
  `예수 닮기를`은 5/31이 아닌 6/7 결단찬양이다. 쉼표로 나열한 날짜를 연속 기간으로
  바꾸거나 날짜 한정 결단찬양을 다른 날짜에 복제하지 않는다.
  백업: `backups/youth-setlist-dedup-before-20260906.json`.
- 2026-09-06 사용자 확인: 청년부 `2026-04-09`는 `2026-04-19` 오기다.
  두 콘티 7행의 내용·곡 연결이 동일함을 검증하고 4/9 중복 원본을 제거했다.
  4/19는 유지하며 옛 입력 자료의 4/9를 다시 가져오지 않는다.
  백업: `backups/setlist-april09-duplicate-before-20260906.json`.
- 주일예배 3부 특송은 제목 정규화·곡 링크·미연결 확인 목록에서 제외한다. 부수 없는
  주일예배 원본의 특송(부활절 칸타타 포함)도 해당하며, 2부 특송과 다른 예배 특송은 유지한다.
- 콘티의 옛 제목은 연결된 DB 제목으로 정리하며, 일회성 제목 별칭은 정리 후 제거한다.
- `능력의 이름 예수`는 사용자가 별도 곡으로 확인했다. `예수 예수` 별칭을 콘티와
  기존 예배 lookup 양쪽에서 제거했으며 미확정 11곡과 함께 독립 곡·기본 버전으로 등록했다.
  가사와 저작자 정보는 임의로 채우지 않았다.
- 콘티 곡명은 곡·버전 metadata의 유일한 일치 후보에만 찬양 DB 링크를 붙인다.
  hover/focus에서 밑줄을 표시하고 기존 곡 열기 동작을 사용한다. 가사는 링크 판정에 조회하지 않는다.
- 메들리는 `+`로 나눈 각 곡에 개별 링크를 붙인다. 화면과 tooltip 모두 연결된
  DB 제목을 표시한다. 옛 제목을 별도로 보존·표시하는 흐름은 두지 않는다.
- 동명곡은 subtitle로 구분 가능한 정확한 표기를 우선하고, 남은 복수 후보는 임의로
  선택하지 않는다. 찬송가 번호/통일찬송가 구분/절 표기를 보존하며 번호 충돌은 미연결로 둔다.
- 2026-09-06 사용자 지시로 콘티 후보 95행의 제목과 normalized payload 제목을
  연결된 DB 제목으로 통일했다. 찬송가 번호·절·순서는 유지한다. 변경 전 백업은
  `backups/setlist-db-titles-before-20260906.json`에만 보관하며 운영 표시에는 사용하지 않는다.
- 2026-09-06 연결 검토 완료: 사용자 지시로 12곡을 신규 등록했고, 내부 레코드만
  남은 `십자가`, `나는 주를 섬기는 것에 후회가 없습니다`, `주 말씀 향하여`는 기존
  canonical ID로 복구해 연결했다. 십자가의 기존 가사는 보존했다.
  `마라나타`는 고형원 CCM, `예수 우리 왕이여`는 예수전도단 번역 CCM으로 연결했다.
  수정 전 기록은 `backups/setlist-create-twelve-20260906.json`,
  `backups/setlist-restore-three-20260906.json`, `backups/setlist-ccm-selection-20260906.json`,
  `backups/setlist-hymn259-before-20260906.json`에 보관한다. 완료된 일회성 확인 목록은 제거했다.

- 역대 콘티의 `sunday-main`/`sun_3rd` 원본은 2부 특송을 함께 담으므로
  `주일예배`로 표시한다. 예배별 그룹에서는 최상단, 주별에서는 같은 날짜의
  다른 예배보다 먼저 둔다. 실제 예배의 1·2·3부 구분은 유지한다.

- 모든 예배의 메인 `찬양`에 표시 순서대로 번호를 붙인다. 한 원본에 함께 기록된
  `2부 특송`·`3부 특송`은 원본 예배 분류와 달라도 숨기지 않는다.
  번호와 부별 label은 화면 표시에서 보존하고 candidate 원본은 수정하지 않는다.

- 역대 콘티는 표시·검색에 필요한 필드와 element 후보만 조회하고 후보 묶음은
  최대 3개씩 병렬로 요청한다. 공개 프로젝트는 프로젝트 URL별 완성된 snapshot을
  6시간까지 캐시해 재방문 시 먼저 표시하고 항상 서버에서 갱신한다. 인증이 필요한
  프로젝트에는 적용하지 않는다. 새로고침은 서버를 직접 조회하며 실패 시 기존
  완성된 화면과 오류를 유지한다. 일부 요청만 성공한 결과로 캐시를 덮어쓰지 않는다.

- 인도자는 원본 `raw_payload.service.leader`의 이름·직분을 그대로 표시하고
  검색에도 포함한다. 값이 없으면 `인도 미기록`으로 표시하며 다른 예배의
  담당자를 추정해 채우지 않는다. 주별 카드는 예배명을 제목으로 쓰고 개별 날짜를
  함께 표시한다. 예배별 카드는 날짜를 제목으로 쓴다. 곡 역할과 곡명은 열을 나누어 표시한다.
- 금요기도회 역대 콘티의 메인 찬양은 `찬양 1·2·3…`으로 표시한다.
  기존 `setlist` import에서 `찬양` 6곡으로 합쳐진 경우 앞의 5곡이 메인
  찬양이고 마지막 1곡은 `입례찬양`이다. 화면에서는 특송 뒤, 결단 앞에
  배치한다. 5곡뿐인 콘티는 모두 메인 찬양으로 유지하며, 다른 예배나
  다른 곡 수에 이 복원 규칙을 확대 적용하지 않는다. 명시적인 `입례찬양`(기존 `예배찬양`)
  항목이 이미 있으면 그것을 사용한다. 이 규칙은 archive 표시용이며
  원본 import 데이터와 현재 예배/Presenter의 입례찬양 규칙을 변경하지 않는다.
- 역대 콘티 전체에서 `예배찬양`은 `입례찬양`으로, 봉헌·결단·기도·파송·폐회·입례는
  `봉헌찬양`처럼 찬양을 붙여 표시한다. 번호는 `기도찬양 1`처럼 뒤에 둔다.
  이미 찬양이 붙은 이름과 특송은 유지하고, 표시명 변경으로 순서를 바꾸지 않는다.
- `주별`(기본)은 일요일~토요일로 묶고 최신 주부터 표시한다. 주 안에서는
  날짜 오름차순, 같은 날짜는 예배 순서대로 표시한다. 월·연도를 넘어도 같은 주로 묶는다.
  `예배별`은 예배 종류별로 묶어 각 그룹 안에서 최신 날짜부터 표시한다. 검색은 두
  보기 모두에 적용하며, 보기 선택은 화면 재진입과 데이터 새로고침 동안 유지한다.
- `역대 콘티`로 이동하면 활성 탭 제목과 저장된 탭 snapshot도 즉시
  갱신한다. 다른 예배 화면으로 돌아가면 해당 화면의 제목을 표시한다.

### Controller Reload Recovery

- Reloading the controller must not stop an already-open Presenter output.
  The output keeps its last rendered frame while the controller reconnects.
- After the output answers the controller's `ready` / heartbeat signal, the
  controller restores the last active service, slide index, blank state, and
  live scripture state from the persisted presenter payload, then republishes
  freshly built slides from the current service data.
- Restoration is only allowed while an output is actually connected and only
  for a payload newer than 12 hours. A stale local payload must never start a
  presentation by itself when the app is opened later.

### Presenter Typography Scale

- Presenter typography is controlled by role tokens, not by individual slide
  exceptions: `Title` (weight 800), `Main song` (800), `Section` (800),
  `Content` / `Lyrics` (700), `Support` (600), and scripture-reading text.
- Fixed measurements on the 1920x1080 stage use a **5px grid**. Timing uses a
  **50ms grid**. Use the closest grid value when adjusting a fixed font size,
  thumbnail size, blank-cross dimension, or animation duration. Percentages,
  container ratios, and typographic ratios (for example the reviewed scripture
  `letter-spacing: -0.06em`) retain their semantic values and are not rounded.
- At the fixed 1920x1080 presenter stage, the reviewed scale is:

  | Role | Chromakey | Fullscreen |
  | --- | ---: | ---: |
  | Title | 90px | 170px |
  | Main song title | 100px | 150px |
  | Section title | 70px | 140px |
  | Content | 70px | 100px |
  | Lyrics | 70px | 100px |
  | Support | 50px | 100px |
  | Formal scripture verse body | 90px | 90px |

- The formal scripture reading deliberately keeps the same 90px verse body
  across output modes. It is a shared reading form rather than a fullscreen
  display variant. This table is the source of truth for future typography
  adjustments; change the role token first, then review the representative
  slides before adding a local override.

### Scripture Input And Reading

- The scripture-reading opening title keeps its reference in the navy lower
  bar. When the reading item has an explicitly entered assignee, show that name
  in a separate white tab attached to the bar's top-right edge, mirroring the
  left scripture-address tab. Empty assignees produce no tab. Do not infer the
  reader from the preacher or praise leader. Verse-body slides and sermon/citation
  address tabs retain their existing layout (2026-09-23).

- `성경봉독` and `설교 본문` are separate visible service elements in chromakey
  services, but their scripture references may be shared when one side is
  intentionally empty.
- Fullscreen/clean public worship does not need a separate `설교 본문` element:
  `성경봉독` is already the fullscreen scripture output. Existing clean-output
  `설교 본문` items are treated as redundant no-output compatibility items.
- A directly entered `성경봉독` reference is valid content for the reading and
  must not be ignored merely because `설교 본문` is empty.
- If `설교 본문` is empty and `성경봉독` has a valid reference, `설교 본문`
  may use the reading reference as fallback so it does not show `입력 필요`.
- If `성경봉독` is empty and `설교 본문` has a valid reference, `성경봉독`
  may use the sermon-body reference as fallback.
- Direct input always wins over fallback input.
- Scripture reference normalization for service inputs follows the Scripture
  search parser: Korean/English abbreviations, attached book+chapter text such
  as `요21:15~25`, `~` ranges, and comma-separated references are accepted.
- Combined scripture ranges use explicit `verse_end` from the Bible table.
  A numbering gap alone does not imply a combined verse. Searches for a contained
  verse resolve the combined body and preserve its reference range.
- `인용 구절` is optional, separate from the sermon body, and may be entered
  before or during worship. An empty citation creates neither a missing warning
  nor an empty slide.
- A scripture-reading final slide keeps the scripture-reading background and is
  followed by one plain trailing blank that suppresses the service background.
  In chromakey output this is the chromakey blank; in fullscreen/clean output it
  is the default blank frame.
- Scripture-reading output uses the installed `Eulyoo1945` / `을유1945` face
  for the verse body text only. The body uses `font-weight: 700`, allows weight
  synthesis, and applies a very small text stroke for projection readability
  because the installed Eulyoo face can render too thin at screen size. The
  reference line and translation label keep the presenter font; `Fin.` shares the
  reading body's font-family token (2026-09-13, see 50px Metadata Typography). Do not
  bundle the Eulyoo font file in this repo.
- Scripture-reading references include the current verse number in the header,
  e.g. `요한계시록 3:19`; the large standalone verse-number column is not used.
- The translation label uses the same color as the reference line and is one
  text-size step larger than the old caption size.
- Scripture-reading output keeps the Eulyoo verse body tighter with
  `letter-spacing: -0.05em` and removes text shadow; body stroke/weight
  synthesis is the other readability boost.

### Ministry Service Auto-Generation

- Youth and young-adult worship stay in the weekly auto-generation flow.
- Children's worship templates and service type remain available for later use,
  but weekly auto-generation is off until explicitly enabled through a reviewed
  product decision. Do not hardcode a September activation date.

### Service Outline And Input State

- Missing-input state belongs to the actionable element only. Section rows show
  structure and start position; they do not repeat an element's `입력 필요`
  badge.
- Fixed liturgical content, shared scripture reading, and fixed closing media
  are not preparation inputs.
- `예배 입력`의 `반영`은 서비스 입력에만 적용하고 저장하지 않는다.
  저장 단축키는 capture 단계에서 Cmd/Ctrl+S를 처리하며 한글 키보드의 KeyS도 인식한다.
  예배 저장은 dirty 판정으로 입력 중인 값의 commit을 건너뛰지 않는다.
  반영 뒤에는 상단 `저장` 버튼이 활성화되며, 사용자가 그 버튼으로
  Supabase 저장을 명시적으로 확정한다.
- `예배 입력`은 현장용 rough text를 받아야 한다. `찬송가 9, 288, 182`
  같은 한 줄 hymn list는 순서대로 `찬양 1`, `찬양 2`, `찬양 3`에
  매핑하고, `성경봉독 롬 8:12~17`, `설교 제목 한 가지 그것을`,
  `봉헌찬송 찬 187장`처럼 colon 없는 known-label line도 인식한다.
- `예배 입력`의 placeholder는 선택된 예배의 editable input만 예시로
  보여준다. Fixed/default/shared output은 예시에 넣지 않는다.
- 메인 예배찬양은 예배 종류별 기본 개수를 시작 양식으로만 둔다. `찬양 6`
  이후도 같은 `찬양` section에 동적으로 추가한다. 일괄 입력은 기존 찬양을
  삭제하지 않으며, 삭제는 각 엘리멘트의 수동 삭제로만 처리한다.
  `찬양 1 곡명` 형식은 같은 번호 슬롯에 연결하고, 성경봉독 직전 찬양은
  성경봉독과 설교 사이의 독립 `입례찬양` section/element로 유지한다. 붙여넣기 입력의 `[팀명.날짜]` 같은
  머리말과 `금요기도회입니다!` 같은 마무리말은 무시하며, 곡명 뒤의 조성
  표기(`G`, `D`, `F#m` 등)는 연주 참고용으로만 보고 곡 검색에서 제외한다.
- 기존 금요 예배의 메인 `찬양` 또는 `성경봉독 전 찬양` 안에 있던 입례찬양은 열 때
  독립 `입례찬양` section으로 정규화한다. `자율기도`는 입력이 필요 없는 고정 순서이므로 missing 상태나
  입력 필드를 만들지 않는다.
- 금요기도회의 `기도회` 섹션에는 `기도찬양 1·2`와 마지막 `자율기도`를
  둔다. `교회소식`은 독립 `광고` 섹션에만 둔다. 기존 데이터의 위치를
  추정해 자동 이동하지 않고, 템플릿 매칭으로 각각의 섹션을 유지한다.
- `인용 구절`은 optional `설교` 엘리멘트다. 풀스크린의
  메인 찬양, 입례찬양, 기도찬양의 제목은 150px, weight 800으로 표시하며
  봉헌·특송 등 다른 순서의 곡 제목과 구분한다.
- `온세대 찬양예배`는 주일 3부 날짜 치환 서비스지만 찬양 곡 수가 고정되지
  않는다. 정확한 전체 순서가 확정되기 전에도 `예배 입력`에 `찬양 1`부터
  `찬양 12`처럼 template보다 많은 메인 찬양이 들어오면, 입력 개수만큼
  `찬양` 섹션의 praise element를 동적으로 materialize한다. 일반 주일 3부의
  기본 `찬양 1~4 + 입례찬양` 구조를 이 규칙으로 바꾸지는 않는다.
- 2026-07-19 온세대 찬양예배 PPT에서 import된 메인 찬양은 `찬양 1 모든
  민족과 방언들 가운데`, `찬양 2 이 눈에 아무 증거 아니 뵈어도`,
  `찬양 3 우리는 주의 백성이오니`, `찬양 4 일어나라 주의 백성`,
  `찬양 5 내 안에 부어 주소서`, `찬양 6 모든 열방 주 볼 때까지 + 물이
  바다 덮음같이`다. 이 곡 목록과 PPT 순서 기반 송폼은 7월 19일 서비스
  인스턴스의 실제 데이터이며, 이후 온세대 날짜에 반복 적용되는 template
  default가 아니다. 온세대 variant에서는 일반 3부의 별도 `입례찬양` 슬롯을
  만들지 않고 입력된 만큼 `찬양 n`으로 둔다.
- 온세대 찬양예배에는 `특송` 섹션은 두되, 일반 3부의 할렐루야 찬양대
  기본 담당자/곡을 자동 주입하지 않는다. 특송은 매 예배마다 입력 가능한
  일반 특송 슬롯으로 유지한다. 온세대 variant의 큰 순서는
  `준비 → 찬양 → 대표기도 → 성경봉독 → 특송 → 설교 → 결단 → 봉헌 → 교회소식 → 파송 → 폐회`다.
  `폐회`에는 표어/마무리 이미지만 두고 `폐회찬송`은 만들지 않는다.
  일반 3부의 `참회기도`, 중간 `찬송`, `신앙고백`, `공동체고백`은 온세대에서
  자동 생성하지 않는다.
- 온세대 variant의 봉헌은 일반 3부의 `봉헌찬송` score slot을 쓰지 않고
  `봉헌특송` praise slot을 사용한다. 2026-07-19만 어린이부 봉헌특송 직후
  PPT 마지막 감사/안내 이미지(`all-generations-2026-07-19-offering-thanks.png`)를
  서비스 인스턴스에 포함한다.
- 일반 3부 특송은 할렐루야 찬양대 운용 때문에 clean/fullscreen output 예외를
  탈 수 있지만, 온세대 찬양예배 특송은 할렐루야 고정 특송이 아니므로 그 예외를
  적용하지 않는다.
- 온세대 찬양예배는 주일 3부 variant이지만 출력 방식은 일반 주일 3부처럼
  chromakey를 사용한다. 온세대 감지는 순서/템플릿 projection에만 쓰고,
  service-wide clean/fullscreen 전환 조건으로 쓰지 않는다.
- 금요기도회는 `성경봉독 → 입례찬양 → 설교` 순서로 진행한다.
- 2026년 8월부터 금요일 예배 자동 생성은 주차별 운영명을 따른다.
  첫째 금요일은 `월삭예배`로 만들고 월삭예배 템플릿을 사용한다.
  둘째 금요일은 `문화예배`로 만들되 영화 관람 등으로 집회가 없는 날이므로
  금요기도회 송출 템플릿을 붙이지 않는다. 셋째 금요일 `삼삼오오예배`는
  찬양 3곡, 입례찬양 없음, 특송 없음, 기도회 없음, 결단 다음 `교회소식`,
  파송 축도, 폐회 뒤 `교제`가 있는 별도 양식을 사용한다. `교제`
  엘리먼트는 축도처럼 고정 순서명에 담당자만 입력한다. 넷째 금요일 `구역연합예배`는
  표시명을 바꾸고 기존 금요기도회 양식을 유지하되, 출력은 chromakey로 사용한다. 다섯째 금요일은
  별도 지시가 없으면 기존 `금요기도회`로 둔다.
- 금요일 저녁에 드리는 예배들은 UI에서 `금요예배` family로 묶고,
  `월삭예배`, `문화예배`, `삼삼오오예배`, `구역연합예배`, `금요기도회`는
  variant로 표시한다. DB service type은 월삭 템플릿과 금요 템플릿을 안정적으로
  유지하기 위해 기존 `monthly`/`friday`를 그대로 사용한다.
- 교회력 `church_schedule`에 `설 연휴`가 있는 주는 정규 예배 찬양 콘티가
  없어도 archive completeness 누락으로 보지 않는다. 이 주의 금요예배가
  문화예배/영화 관람 등으로 대체된 경우에도 빈 콘티가 정상 상태다.
- 예전 찬양 콘티 archive completeness audit에서는 사무총회/사무총회 속회,
  온세대/통합예배, 부서 헌신예배 때문에 해당 부서가 주일오후예배와 연합한
  날짜를 누락으로 보지 않는다. 2026년 상반기 audit 기준으로 실제 확인이
  필요한 누락 후보는 `2026-06-10` 수요예배와 `2026-06-17` 수요예배다.
- `삼삼오오예배`는 `friday` 계열 variant이며 금요기도회와 같은 clean/fullscreen
  output을 사용한다.
- 풀스크린 예배의 준비 element 표시명은 `대기 화면`으로 둔다. 실제 준비 화면은
  이미지/영상/기본 화면을 모두 쓸 수 있으므로 `대기 영상`처럼 특정 media type으로
  고정해 부르지 않는다. 기존 `대기 영상` 저장값은 legacy alias로 계속 인식한다.
- 풀스크린 `대기 화면`의 기도 준비 문구는 안내 톤으로 작게 두고, `잠시 후
  {예배명}가 시작됩니다`도 본문보다 과한 display scale을 쓰지 않는다. 예배 이름만
  굵게 강조하고 전체 화면은 차분한 waiting screen으로 유지한다.
- 출력 창은 BroadcastChannel 연결 시 이전 local payload를 재출력하지 않고
  현재 controller state를 기다린다. 따라서 풀스크린 예배 시작 시 이전
  크로마키 프레임이 잠깐 노출되지 않는다.
- 풀스크린의 빈 화면 십자가는 세로선을 위에서 아래로 먼저 그린 뒤,
  가로선을 왼쪽에서 오른쪽으로 이어 그린다. 크로마키 빈 화면에는 십자가를
  표시하지 않는다.
- 풀스크린 예배의 설교 `인용 구절`은 성경봉독과 같은 말씀 전용 화면으로
  출력한다. 크로마키 예배에서는 기존 하단 바 성구 화면을 유지한다.
- 금요기도회의 기본 배경은 `26-B` 계열이다. 서비스별로 직접 고른
  배경은 유지하지만, 금요기도회 템플릿/자동 생성 기본값은 `B` 그룹을
  따른다.
- `말씀 <제목>`은 성경 주소처럼 보이지 않으면 `설교 제목`으로,
  `설교 <이름/직분>`은 설교 제목 요소의 담당자로 반영한다.
- 찬양 DB에서 원제/부제/첫 가사 등으로도 곡을 하나로 찾지 못하면,
  새찬송가 score 전용 슬롯을 제외하고 입력 제목의 빈 Praise record를
  만들고 해당 예배 항목에 연결한다. 사용자는 나중에 Praise 탭에서
  가사와 버전을 채운다.
- Fullscreen/clean output의 찬양·특송 등 song-like 항목은 입력 전
  `입력 필요` placeholder도 실제 곡 입력 후와 같은 lower-bar song frame을
  사용한다. 담당자/기도 등 title-person 항목은 기존 center title-content
  placeholder를 유지한다.
- 찬양 제목 앞 표기는 16분음표 `♬`를 쓰며, 한글 제목 폰트를 바꾸지 않고 별도 inline glyph로
  크기와 baseline만 보정한다. 풀스크린/clean output은 실제 송출 화면에만
  250ms 이하의 약한 opacity/brightness dissolve를 적용할 수 있으며,
  controller thumbnails와 chromakey/shared scripture output에는 적용하지 않는다.

### Public Worship Timing

- Home selects public Worship by each service's actual KST meeting window, not
  by service date alone. A currently running service is shown before the next
  future service.
- Regular windows are: 수요예배 `19:10-20:30`, 금요기도회 and 월삭예배
  `20:00-22:00`, 주일예배 [1부] `07:00-08:00`, [2부] `08:50-10:00`,
  [3부] `10:50-12:00`, and 주일오후예배 `13:20-14:30`.
- Department and special services have no inferred time window. Until they
  carry explicit timing metadata, Home falls back to their service date.

### Default Ministers

- Default sermon/benediction ministers are template defaults, not missing
  preparation inputs. A per-service edit may override them.
- 주일예배 [1부] rotates weekly from `2026-08-23` (`김광한 전도사`), then
  `김석범 목사`. `김광한 전도사` weeks use `주기도문` instead of `축도`;
  `김석범 목사` weeks use `축도` 담당 `김석범 목사`.
- 주일예배 [2부], [3부], 주일오후예배, 수요예배, and 월삭예배 default to
  김남영 목사 for sermon and benediction when those elements exist.
- 금요기도회 defaults to 김남영 목사 for sermon. It has no benediction element.
- 청년부 예배 defaults to 김석범 목사 for sermon, offering prayer, and
  benediction.
- In the sending section, `축도` and `주기도문` are mutually exclusive in the
  presenter/order projection. If both legacy/persisted items exist, keep `축도`
  and drop `주기도문`.

### Sunday Public Worship Templates

- Sunday first and second service share the same three main-praise contents:
  `찬양 1`, `찬양 2`, and `찬양 3`.
- Sunday third service praise/hymn slots are not shared into first/second
  main-praise slots; only second/third scripture and sermon content are linked.
- Sunday second and third service share scripture reading and the whole sermon
  section content: `성경봉독`, `설교 제목`, `설교 본문`, and `인용 구절`.
- Sunday first, second, and third service share `봉헌찬송`.
- These are same-date linked content rules, not presenter-only fallback.
  When a linked slot is filled, edited, or cleared in one service, saving writes
  the same content to the other same-date services in its sharing group.
  Presenter fallback may remain only as legacy recovery for older rows that have
  not been normalized yet.
- Sunday first and second service doxology is fixed to hymn 5,
  `이 천지간 만물들아`.
- Sunday afternoon doxology is fixed to hymn 1, `만복의 근원 하나님`.
- A fixed doxology is output content, not an input. It must not appear in the
  input rail, block saving, or produce an `입력 필요` warning.
- Sunday afternoon worship starts with four main-praise slots:
  `찬양 1` through `찬양 4`.
- Sunday afternoon worship uses the dedication-service order by default because
  most afternoon services are dedication services. `특송` and `봉헌`
  (`봉헌찬송`, `봉헌기도`) stay in the base template; non-dedication days should
  skip/hide those slots instead of removing them from the scaffold.
- Sunday third service uses the same `신앙고백 → 사도신경` title-slide rule as
  the first and second services. `공동체고백` and `주기도문` also retain their
  own title slides before their body text.
- Template-provided praise defaults are real linked Praise selections, not
  display-only text. Sunday third preloads `입례찬양` (내 한 가지 소원),
  `파송찬송` (359 천성을 향해 가는 성도들아), and `폐회찬송` (352 십자가
  군병들아) when their catalog records are available.
- These are template rules, not copied weekly content. A service instance may
  override them only through a deliberate template-modified edit.
- 주일예배 [3부] 특송 is allowed to be a one-off manual choir item. When the
  element carries manual slides/body, it must not auto-link to Praise DB even
  if the title matches a hymn, because choir arrangements often reuse hymn
  titles with custom lyrics.
- 특송 elements may carry a deliberate image deck in `asset.slides`. In that
  case the presenter outputs those images as-is and does not add an extra
  generated title slide, because the supplied deck is already designed for
  projection.

### Youth Worship Template

- 청소년부 예배 is a regular 10:50 Sunday ministry service. On a date marked
  `온세대 찬양예배`, it is not generated because youth worship is integrated
  with 주일예배 [3부].
- New 청소년부 예배 services receive this weekly scaffold: `사도신경`, main
  praise 3곡, `대표기도`, `봉헌` (`봉헌찬양`, `봉헌기도`), `성경봉독`, `설교`,
  `결단기도`, `광고`, `주기도문`, and `반별 모임`.
- `통성기도` and `결단찬양` are not part of the regular youth template unless
  a user deliberately adds them for that service.
- In every service template, the child element of the `대표기도` section is also
  labeled `대표기도`. Legacy projected items labeled `기도` are normalized for
  display without changing their leader or entered content.
- The regular `봉헌찬양` default is `대단한 믿음 없어도` with the `V1-C` song
  form. It is prefilled for each weekly service rather than copied from the
  previous week.

### Preparation Input Parsing

- `본문`, `성경본문`, `설교본문`, `말씀`, and `말씀본문` are dynamic
  preparation aliases. If the service has a `설교 본문` element, they target
  that element; otherwise they target `성경봉독`.
- This keeps fullscreen/clean public worship from failing when it has no
  separate `설교 본문` input because `성경봉독` is the fullscreen scripture
  source.
- `인용 구절` accepts the same scripture-reference normalization as scripture
  search, including abbreviations, `~`, and comma-separated references. If a
  service has no `설교 본문` element, citation slides are inserted in the
  sermon section after `설교 제목`.
- Implicit praise shorthand numbering advances from the highest explicit
  `찬양 N` already parsed, so mixed explicit and shorthand lines do not reuse a
  number.

### Hymn Version Selection

- When a hymn has both 새찬송가 and 통일찬송가 versions, 새찬송가 is the
  default in Praise and service-item selection.
- 통일찬송가 is an explicit exception. It remains selectable and is used by
  default only when it is the sole available hymn-book version.
- Existing linked song versions are preserved; this default applies when a
  version is newly selected or resolved.
- Worship preparation input and service-item auto-linking use the same
  preferred 새찬송가 default, so resolved hymn-score praise does not remain
  missing only because a version was not explicitly picked.

### Score Praise Output

- `특송` praise items with an assignee output a separate `특송 / 담당자`
  title-assignee slide before the normal praise song-title slide. The song-title
  slide remains visible and carries the song name.
- Hymn-score praise items such as `봉헌찬송` and `송영` keep the normal
  `song-title` title slide. Do not create a separate score-only title layout.
- Score-mode praise may resolve a song from the raw title, so rough input like
  `찬송 80` can find hymn score slides even before the item has a persisted
  `song_id`. `특송` is the explicit exception: it must never output hymn score
  images, even if an item still carries `outputMode: "score"`.
- Non-score praise items that require DB selection must not silently resolve
  lyrics by raw title alone. Leave them as `입력 필요` unless they have a
  linked song or explicit manual slide text.
- Only the score image slides use the score fullscreen contract. A score image
  slide must render as the primary `score` slide class before generic image
  handling so fullscreen output does not inherit chromakey or lower-bar image
  fallback behavior.
- Score image slides remain clean fullscreen media with a white score canvas and
  no visible presenter meta. Title slides remain the same praise title contract
  as non-score praise.
- In chromakey services, the automatic blank after a score image returns to the
  chromakey blank context. It must not appear as a black fullscreen blank behind
  or after the score.

### Presenter Song Forms

- Coda supports A/B groups, including numbered labels and `Ending` aliases.
  Preserve their identity through relational label save/reload and form presets.
  Explicit grouped blocks play their complete stored lyrics; only an ungrouped
  source block is virtually split for an A/B request. Missing explicit groups
  must not resolve to a different group. Existing `Coda@A` variants stay distinct.

- Explicit song-form presets may intentionally omit unlisted forms when they
  are grouped (`V1A`, `V1B`), manual/forced/song-default presets, or contain
  deliberate consecutive repeats such as `C-C`.
- User-entered `manual` song forms are exact output instructions. A typed
  sequence such as `V-C-V-C` or `V-C-V-C-Tag` must not auto-preserve unlisted
  `Bridge`, `Pre-Chorus`, or extra chorus forms from the linked song version.
  Template `default` and `forced` presets follow the same exactness rule unless
  they explicitly list the supplemental forms.
- An automatic/default preset must not show `C 없음` when the linked source
  song has no chorus form at all. Explicit manual requests still surface a
  missing-form warning so an operator typo does not pass silently.
- Grouped labels such as `V1A` and `V1B` mean split `Verse 1` by lyric block.
  If there are no blank-line blocks, split evenly by lyric lines when possible.
- `amen`/`아멘` is not a song-form type. Existing form rows have been migrated
  to `Coda`; import, parser, backfill, and presenter paths must not create it.

## Source Of Truth

- Runtime public-worship template rules: `app.js`.
- Worship data ownership and persistence model:
  `docs/worship-data-contract.md`.
- Presenter-specific workflow and verification:
  `docs/thread-worship-presenter.md`.

## Worship Service Identity

- `mindex_worship_services`에는 범용 `tags`를 두지 않는다. 날짜별로 화면에
  표시할 공개 이름은 `service_alias`에 저장한다. 예: `온세대 찬양예배`,
  `청소년부 제자헌신예배`.
- `금요기도회`, `월삭예배`, `삼삼오오예배`, `문화예배`, `구역연합예배`는
  제목을 하나로 덮어쓰지 않는다. 전체 예배 목록 UI에서는 같은 family인
  `금요예배`로 묶고, 각 카드에는 variant 이름을 subtitle로 표시한다.
- 정규 예배 유형과 기본 제목은 `service_type_id`와 `title`이 소유한다.
  별명은 이 값을 덮어쓰지 않으며, 목록·검색·프레젠터 표시에서만 우선한다.
- 찬양대·찬양팀 이름은 해당 찬양 섹션의 담당자, 집회 없음·헌신예배 같은
  machine state는 typed `source_ref`, 절기와 교회 일정은 교회력 데이터가 각각 소유한다.
  별명에 이 값을 합쳐 저장하거나 새 범용 metadata bucket을 만들지 않는다.

## Presenter Output Rules
- Controller startup restores display coordinates in the background only when
  `window-management` permission is already granted. Otherwise display detection
  remains an explicit user action. Electron uses its existing display bridge.
  Output launch never awaits detection; saved available targets retain priority.
  Display-change events update future launch targets, never move or reopen live
  output windows, and never request fullscreen.
- `참고 화면`은 전역 presenter toolbar가 아니라 `설교` 또는 `광고` 섹션에 추가한다.
  `참고 화면 추가`는 해당 섹션의 마지막에 image element를 만들며, 이름과
  파일/링크를 채우면 기존 media contract로 clean fullscreen output에 송출한다.
  따라서 크로마키 예배에서도 참고 이미지는 green background나 lower bar를
  물려받지 않는다. 영상은 동일한 asset element contract를 확장해 추가한다.
- `주일오후예배`는 기본적으로 헌신예배 순서를 따른다. `특송`은
  악보(score)가 아니라 일반 praise/lyrics 입력이며, `봉헌찬송`만 score
  output을 사용한다. 헌신예배가 아닌 날에는 `특송`/`봉헌` slot을
  skip/hide한다.
- 크로마키 찬양 제목 slide는 본문 가사 크기와 별도로 더 큰 제목 scale을
  사용한다. 설교 제목 lower bar는 왼쪽 `설교` label을 출력하지 않고
  설교 제목을 왼쪽, 담당자를 오른쪽에 둔다.
- 모든 예배 타입의 설교 제목은 presenter와 프리뷰에서 홑낫표
  `｢제목｣`로 감싼다. 입력에 기존 따옴표가 있어도 출력에서는 중첩하지 않는다.
- 크로마키 lower-bar 성구는 하단 bar 안에 들어오는 것이 우선이다. 긴 절은
  presenter/thumbnail 공통 fit 로직으로 최대 32px까지 줄이고, bar 밖으로
  overflow시키지 않는다.
- Presenter sidebar의 순서 row를 누르면 개별 thumb가 아니라 해당 element
  subgroup의 시작점으로 board를 이동한다. 긴 찬양/지연 렌더 구간에서도
  선택된 순서의 입력·thumb 영역이 빈 화면 없이 보이는 것이 우선이다.

## Benediction Replacement
- 모든 예배의 축도 입력 영역에 `주기도문으로 변경` 버튼을 제공한다.
- 변경은 해당 예배 요소에만 저장하며 공통 양식과 다른 예배는 수정하지 않는다.
- `config.benedictionReplacement` version 1에 원래 축도 필드를 보관한다.
  원래 slot identity를 유지하여 재조회 시 축도가 다시 생성되지 않게 한다.
- 주기도문은 기존 공통 본문/렌더러를 사용한다. `축도로 되돌리기`는 보관한
  담당자, 제목, 메모를 복원하며 replacement metadata를 제거한다.
- 예배 document exceptions에는 `benediction_replacement` 사유를 남긴다.
- 주일 1부의 기존 설교자별 기본 순서 판정은 변경하지 않는다.

## Service Auto-Schedule Rules
- 금요 2주 문화예배와 3주 삼삼오오예배의 자동 배정은 2026년 8월에만
  적용한다. 이후 2·3주는 기본 금요기도회이며, 명시적으로 지정한 개별
  예외는 유지한다. 1주 월삭예배와 4주 구역연합예배 규칙은 유지한다.
- 어린이부 예배, 청소년부 예배, 청년부 예배는 주일 자동 생성 대상이다.
- 단, 해당 주일의 교회력 `church_schedule`에 `온세대 찬양예배`가
  명시된 경우에만 어린이부, 청소년부, 청년부 예배를 별도로 생성하지
  않는다. 그날은 3부 예배(`sunday-main`)가 통합 예배의 source of
  truth다. `service_alias`, 절기명, 메모, 부서 담당 정보만으로는 부서 예배의
  자동 생성을 제외하지 않는다. 기존 예배의 명시적 온세대 지정은 아래
  2026-10-14 projection 규칙에 따라 순서에 반영한다.
- 부서별 외부 모임처럼 해당 부서의 MINDEX 예배가 따로 없는 날은
  교회력 `church_schedule`의 stable phrase를 기준으로 해당 부서
  자동 생성을 제외한다. 예: `청년부 야외예배`는 `young-adult` 예배를
  생성하지 않는다. 기존에 자동 생성된 row도 auto-generated source_ref가
  확인될 때만 purge한다.
- 이미 일반 3부 template으로 materialized 된 3부 예배가 나중에 교회력상
  온세대 찬양예배로 판정되면, projection 단계에서 수정되지 않은 일반
  3부 전용 항목(`참회기도`, `찬송`, `입례찬양`, `사도신경`, `공동체고백`,
  기존 `봉헌찬송`, `폐회찬송`)은 제거한다. `새가족환영`은 3부 공통 안내 slot으로
  유지한다. 사용자가 수정한 항목은
  `template_modified`를 존중해 보존한다.

## Empty Praise Removal from Source Text
- 예배 원문에서 빈 찬양 줄을 지우면 해당 예배의 template suppression을 저장하여 재조회·양식 투영 후에도 다시 생성하지 않는다.
- 원문 항목이 모두 매칭된 경우만 적용하며, 곡·직접 입력·가사·파일이 있는 순서와 찬양 이외 항목은 이 처리로 삭제하지 않는다.

## Linked Praise Hydration and Medley Labels
- 곡 목록 로딩 지연·실패로 연결된 곡을 찾지 못해도 저장된 song/version ID를 지우지 않는다. 연결 해제와 직접 입력 전환은 기존 명시적 사용자 동작으로 처리한다.
- 송출 슬라이드 내부 순서명은 번호를 생략한다(메들리 포함: `찬양 6–7` → `찬양`, `공동기도 ③·④` → `공동기도`). 컨트롤러 목록·입력 제목과 저장 데이터의 번호는 유지한다. 썸네일·미리보기의 슬라이드 내용도 같은 출력 규칙을 따른다. 찬송가 장수·성경 주소·본문 숫자는 변경하지 않는다.

## Song Form Input Normalization
- 송폼 입력·저장 시 알려진 영문 토큰을 `V`, `PC`, `C`, `B`, `Int`, `Tag`, `Tags`, `Coda`, `VL`로 정규화하고 구분자 앞뒤 공백을 제거한다. 예: `v1a - pc - c - 간주` → `V1A-PC-C-Int`.
- 절 번호·부분 구분·반복 순서·빈 입력은 유지한다. 한글 표기도 `1절 → V1`, `후렴 → C`, `마지막 절 → VL`, `간주 → Int`로 통일한다. 알 수 없는 토큰은 임의로 바꾸거나 삭제하지 않는다.

## Calendar Assignees at Service Creation
- 자동·수동 예배 생성 시 교회력을 먼저 읽고 담당을 실제 `mindex_worship_elements.person`에 저장한다. 어린이부·청소년부·청년부 대표기도 및 어린이부·청소년부 봉헌기도에 동일한 규칙을 적용한다.
- 어린이부 봉헌기도자와 헌금위원은 같은 사람이며, 신규 예배 생성 시 `children_prayer`를 복사한다. 이 값이 비면 유치부 담당으로 대체하지 않는다. 기존 예배를 소급 변경하지 않는다.
- 화면·주보는 교회력 담당을 실시간 대체값으로 사용하지 않는다. 생성 이후 교회력 변경이나 재조회로 저장된 담당(빈칸 포함)을 덮어쓰지 않는다.
- 교회력 로딩 실패는 담당이 없는 날과 구분하여 생성을 중단한다. 담당 요소 저장 실패 시 이번에 만든 예배만 정리하고 오류를 알린다.

## Setlist Sunday Order and Worship Leaders
- 역대 콘티의 통합 주일예배 카드는 2부 특송을 가장 먼저 표시하며 나머지 곡 순서는 유지한다. 기존에 카드 안에 들어 있던 2부 특송과 별도 2부 예배에서 합친 특송에 같은 규칙을 적용한다.
- 주일·수요 콘티의 인도는 저장된 찬양 인도자(`praise_leader`)를 사용한다. 일반 주일예배는 김석범 목사, 온세대는 이재희 청년이다.
- 수요예배 찬양인도자는 확인된 날짜별 저장값을 사용한다. 고정 격주 자동 계산은 실제 일정과 달라 제거한다.

- 찬양 인도자 메타데이터는 콘티 표시에 사용하며 송출의 빈 담당 칸으로 자동 대입하지 않는다. 순서에 명시한 담당은 유지한다.

## Existing Worship Content Repairs (2026-09-13)

- 참회기도는 기존 제목 슬라이드만으로 완료된 순서다. 빈 본문을 미입력으로 판정하지 않으며 송출은 그대로 유지한다.
- 7/5 및 7/17의 기존 찬양·설교 순서는 저장된 label/slotKey를 현재 표준으로 정리한다. 날짜별 코드 예외로 빈 항목을 숨기지 않는다.
- 7/17 기도찬양 1은 가사 없는 구 버전 대신 같은 곡 ‘마지막 날에’의 가사 있는 기본 버전에 연결한다.
- 8/30 2부 찬양 1은 사용자 확인에 따라 1부의 ‘10 전능왕 오셔서’와 동일한 찬송가 버전·악보·송폼 설정을 사용한다. 실제 미입력 및 미래 예배 데이터는 수정하지 않는다.

## Praise Leader Field Correction (2026-09-13)

- 현재 인도자 정보는 모두 찬양인도자(`praise_leader`)다. `worship_leader`는 미사용 예약 필드이며 신규 생성·저장 시 비워 두고 담당/검색/콘티 fallback으로 사용하지 않는다.
- 사용자 확인에 따라 예전 예배인도자 35건을 찬양인도자로 이동한다. 기존 찬양인도자는 유지하되, 확인된 주일 3부·수요 규칙이 찬양단 명칭보다 우선한다. 순서별 담당과 찬양단 표시는 변경하지 않는다.
- 1·2부의 저장된 찬양인도자도 보존·편집할 수 있다. 설교자에서 추론하는 기본값은 추가하지 않는다.

- 2026-09-13 확인: 수요 8/12 김광한, 8/19 김석범, 8/26 김광한, 9/2 김석범, 9/9 김광한. 자동 계산으로 입력한 미확인 9/16 인도자는 비운다. 신규 수요예배의 찬양인도자는 자동 입력하지 않는다.

## Setlist Card Praise Leader Editing (2026-09-13)

- 주별/예배별 콘티 카드의 인도자는 항상 텍스트 입력칸으로 표시한다. 별도 편집 버튼이나 모드 전환 없이 그 자리에서 입력한다. 입력 후 포커스 이동 또는 Enter로 자동 저장하며 Escape로 취소한다. 저장·취소 버튼과 성공 알림은 표시하지 않는다. 빈 값은 ‘—’로 표시한다.
- 실제 예배는 `praise_leader`만 갱신한다. 이전 콘티는 기존 `raw_payload.service.leader`만 바꾸며 나머지 원문은 보존한다. 조회 시 전체 원문을 추가로 읽지 않는다.
- 수정 전 값 또는 최신 행의 갱신 시각을 확인해 동시 변경을 덮어쓰지 않는다. 저장 실패 시 입력 초안을 유지한다. 성공한 값은 현재 화면과 콘티 캐시에도 반영한다.

- 콘티 인도자 편집에 연필 아이콘을 표시하지 않는다. 빈 값의 ‘—’는 약한 텍스트 색으로 표시하며 이름/기호 자체를 눌러 편집한다.

- 인도자 입력은 투명 배경을 사용하며 밑줄·테두리·색상 강조·박스형 포커스 효과를 적용하지 않는다. 키보드로 편집 버튼에 접근할 때는 최소한의 포커스 표시를 유지한다.

- 어린이부 미기록 7건은 해당 날짜 주보와 사용자 확인으로 서영윤 선생님, 청소년부 미기록 6건은 사용자 지정으로 허호범 선생님을 저장했다. 부서별 자동 채움 규칙은 추가하지 않는다.

- 교사/선생님 표기 확인은 역대 콘티 인도자 범위에 한정한다. 2026-09-13 확인 당시 해당 인도자 값에 ‘교사’ 표기는 없으며 다른 순서의 담당 표기는 변경하지 않는다.


### 2026-09-13 찬양인도자 생성 기본값
- 새 예배에만 기본값을 저장한다. 주일예배 김석범 목사(온세대 찬양예배 이재희 청년), 주일오후 박수경 집사, 어린이부 서영윤 선생님, 청소년부 허호범 선생님, 청년부 이재희 청년, 금요 이재희 청년(삼삼오오 김덕열 집사).
- 생성 폼의 날짜·별명이 바뀌면 기본값을 갱신하되 사용자가 직접 수정하거나 지운 값은 유지한다. 기존 예배는 소급 변경하지 않는다. 수요는 사용자 승인에 따라 2026-09-16 김석범 목사 → 9/23 김광한 전도사를 기준으로 매주 교대한다. 이 기준 이전 날짜에는 소급 계산하지 않고, 수요일이 아닌 날짜에는 자동 배정하지 않는다.
- 청년부 서영윤 인도는 유치부 여름성경학교 기간에도 발생한다. 청년부 인도자만으로 주일오후 대체 인도자를 확정하지 않는다.


### 2026-09-16 역대 콘티 예배 바로가기
- 주별 카드의 예배 제목과 예배별 카드의 날짜는 실제 예배 화면으로 이동한다. 기존 selectService 경로로 미저장 변경 확인과 브라우저 이력을 유지한다.
- 명시적인 service_id를 우선 사용하고, 과거 콘티는 날짜·예배 종류가 일치하는 실제 예배가 하나일 때만 연결한다. 데이터가 없거나 중복으로 모호한 경우 제목을 일반 텍스트로 유지한다. 통합 주일 카드는 3부로 연결한다.


### 2026-09-16 주간 예배 공백 구분
- 집회 없음은 확정 사유가 있는 경우에만 표시하며 옅은 카드에 사유를 유지한다. 콘티 미등록은 예배 기록이 있지만 찬양 목록이 없는 경우 강조 표시하고 실제 예배 바로가기를 제공한다.
- 기록 자체가 없는 날짜는 집회 여부 미확인으로 표시한다. 단순한 콘티 공백으로 집회 없음을 추정하지 않는다. 빈 콘티 원본과 실제 예배의 집회 없음 정보가 함께 있으면 집회 없음 정보를 적용한다.


### 2026-09-18 역대 콘티 UX 검토 수정
- 인도자 자동 저장은 해당 입력 노드의 값·읽기 전용 상태만 갱신한다. 저장 시작·완료·변경 없음 처리에서 상세 화면을 다시 그리지 않아 포커스 이동과 첫 클릭을 보존한다. 실패 시 입력값을 유지하며 재시도할 수 있다.
- 주간 상태 카드는 검색과 보기별 그룹화 전에 한 번 생성한다. 주별·예배별·검색이 같은 카드 집합을 사용하고 집회 상태와 사유도 검색 대상에 포함한다.


### 2026-09-19 순서명과 독립 내용 제목 분리
- title/title_person 유형에서 순서명과 같은 내용 제목은 로드·편집·새 예배 생성·저장 공통 경로에서 빈 독립 제목으로 정규화한다. 항목명별 예외를 추가하지 않는다.
- title 유형은 독립 제목이 없어도 순서명으로 송출하며 정상 완료로 판정한다. title_person은 기존 담당/설교 제목 필수 판정을 유지한다. 사용자 지정 제목, 본문·찬양·성경·미디어는 이 정규화에서 제외한다.
- 기존 DB 정리는 동일 조건의 title 필드만 변경하고 본문·담당·곡 연결을 보존한다.


### 2026-09-19 전체 예배 목록 전치
- 전체 예배에서 공예배·부서별 그룹 안의 예배 종류를 가로 열로 배치하고, 각 열의 예배 날짜는 최신순으로 세로 나열한다.
- 좁은 화면에서는 그룹 내부 가로 스크롤을 제공한다. 최근 예배·개별 예배 종류 화면의 카드 배치와 데이터 정렬은 유지한다.


### 2026-09-19 자율기도 음원 시작 지연 개선
- 자율기도 음악 컨트롤을 처음 표시할 때 단일 Audio 인스턴스를 생성해 preload=auto로 준비한다. 다시 그려도 재생 위치를 초기화하거나 재로딩하지 않으며 재생은 사용자 버튼으로만 시작한다.
- 음원의 moov 메타데이터를 mdat 앞에 배치하고 청크 오프셋을 보정했다. 압축 오디오 데이터는 바이트 단위로 동일하며 앞부분의 작은 소리·길이·음질은 보존한다. 파일 URL 버전을 변경해 이전 캐시를 피한다.


### 2026-09-19 자율기도 음악 컨트롤 UI
- 재생 버튼 폭을 고정하고 재생·정지·반복·음량을 함께 묶어 좁은 폭에서 조작부 전체가 다음 줄로 이동하게 한다. 공통 음량 선택창과 반복 활성 스타일을 사용한다.
- 재생 요청 대기는 회전 아이콘과 ‘준비 중’으로 표시하고 aria-busy를 제공한다. 대기 중 다시 누르면 취소할 수 있다. 실제 재생 상태와 구분하며 동작 감소 설정에서는 회전을 생략한다.


### 2026-09-19 음악 컨트롤 공통화 (앞선 자율기도 전용 구현 대체)
- 자율기도 전용 상태, Audio 인스턴스, 이벤트 핸들러, 재생 함수와 CSS를 제거한다. 기존 serviceMusic 플레이어와 renderServiceMusicPlayer를 인라인·사이드바에서 함께 사용한다.
- 슬롯별 차이는 SERVICE_SLOT_MUSIC의 기본 음원·표시명·repeatAllowed 설정으로만 표현한다. 자율기도는 반복 기능을 제공하지 않는다. 표시명 기반 예외나 금요예배 전용 재생 엔진을 만들지 않는다.
- 공통 플레이어의 pending/요청 일련번호가 로딩 표시와 취소 경합을 처리한다. 화면을 열 때 기존 음원이 있으면 교체하지 않으며, 사용자가 해당 슬롯의 재생을 누를 때만 전환한다. 동시에 두 음원을 겹쳐 재생하지 않는다.


### 2026-09-20 컨트롤러 슬라이드 크기 설정
- 컨트롤러를 크게 보려고 브라우저 확대를 쓰면 같은 사이트의 모든 창(설치한 앱의 송출 창 포함)에 같은 배율이 적용된다. 컨트롤러 전용 확대는 브라우저 확대 대신 앱 설정으로 제공한다.
- 슬라이드 보드 위 ‘슬라이드 크기’(기본·크게·더 크게·가장 크게)가 썸네일 기준 너비(`--svc-thumb-width`)에 1·1.3·1.6·2배를 곱한다. 좁은 화면 구간(1180px, 760px 이하)의 기준 너비에도 같은 배수를 적용한다. 값은 이 기기의 localStorage(`mindex.ui.presenterThumbScale`)에 저장한다.
- 송출 창(`?output=presenter`)은 이 값을 읽지 않는다. 컨트롤러 초기화 경로에서만 적용한다.


### 2026-09-20 이전 저장본(이력)을 얇게 저장
- 이력 항목은 원문(`sourceText`)과 항목·슬라이드 개수, 전체 내용 서명(`contentSignature`)만 저장한다. `slides`, `sourceRecords`, `exceptions` 배열은 저장하지 않는다(측정: 이력 용량의 98% 이상, 복구는 원문만 사용).
- 이전 저장본 목록의 개수 표시와 원문 복구 동작은 그대로다. 옛 항목(배열 포함)도 읽고, 다음 저장 때 얇은 형태로 다시 쓴다.
- 서명은 같지만 슬라이드·기록·예외 내용이 달라진 저장은 여전히 이력에 남는다(`contentSignature`로 판정).
- 자세한 근거와 기존 데이터 재작성 절차는 `design-worship-service-history-storage.md`.


### 2026-09-21 미등록 예배 종류 정렬
- DB 종류 목록에 없는 예배도 SERVICE_CATEGORIES의 같은 그룹 내 위치를 사용한다. 등록된 이웃의 순위 사이에 배치하며 기존 DB 순위는 보존한다. 유치부는 어린이부 앞에 표시된다.


### 2026-09-21 역대 콘티 기간 선택·예배 바로가기
- ‘주별’을 ‘기간별’로 변경하고 연도·월 선택을 제공한다. 선택된 실제 예배 날짜만 필터링하며 결과는 기존 주간 단위로 묶는다. 전체 연도·전체 월로 범위를 해제할 수 있고 예배별 보기에는 기간 필터를 적용하지 않는다.
- 예배별 보기는 각 종류의 제목으로 이동하는 바로가기를 제공한다. 월삭은 주간 금요일 자리를 공유하지만 저장된 종류를 보존해 금요와 별도 그룹으로 표시한다.
- 사용자 확인: 2026년 8월부터 월삭예배 별명은 온세대 월삭예배. 해당 실제 예배의 별명을 저장하며 UI에 날짜 예외를 하드코딩하지 않는다.
- 2026-09-30 재확인: 기존 8월 이후 금요일 생성 설정의 월삭 별명도 동일하게 지정한다. 예배 유형 ID는 `monthly`를 유지하며 7월 이전 기록은 변경하지 않는다.


### 2026-09-21 콘티 연도 범위
- 연도 범위는 실제 콘티·예배 기록이 있는 연도로 제한한다. 2026년 1월 첫 주를 구성하며 생성된 2025년 12월의 빈 상태 카드 때문에 2025년 선택지가 나타나지 않게 한다. 첫 주의 주간 구간 제목은 유지한다.


### 2026-09-21 금요·월삭 통합 묶음 (사용자 정정)
- 예배별 보기에서 금요기도회와 월삭예배는 ‘금요예배’ 한 그룹과 한 바로가기로 통합한다. 원래 예배 종류는 보존하고 카드의 월삭예배/온세대 월삭예배 표기는 유지한다. 앞선 별도 그룹 결정은 이 지침으로 대체한다.


### 2026-09-21 콘티 연도 시작 범위 정정
- 실제 2025-12-28 청소년부 원본 기록이 있어도 역대 콘티 표시·연도 선택 범위는 사용자 요청대로 2026년부터 시작한다. 원본 레코드는 삭제하지 않는다. 단순 ‘실제 기록 존재’ 조건으로 2025년을 다시 노출하지 않는다.


### 2026-09-21 역대 콘티 가독성
- 주간 제목은 같은 달이면 ‘9월 6–12일’, 달이 바뀌면 양쪽 월을, 연도가 바뀌면 양쪽 연도를 표시한다. 내부 날짜 키·필터·정렬은 유지한다.
- 곡 제목과 카드 제목을 주요 정보로 유지하고 순서명·날짜·인도자·별명은 보조 위계로 낮춘다. 집회 상태 카드는 구분선과 과한 여백을 줄이며 사유·미등록 강조·예배 링크는 보존한다.


### 2026-09-22 연도 선택 제거·빈 주간 상태 범위
- 연도 선택과 연도 필터·선택값 초기화 로직을 제거하고 월 선택만 유지한다. 실제 2025-12-28 청소년부 콘티는 보존하고 표시한다.
- 주간 집회 현황의 자동 빈 카드 생성 시작일은 2026-01-01로 지정한다. 그 이전의 실제 기록은 그대로 통과시키되, 존재하지 않는 예배의 빈 카드는 생성하지 않는다. 2025년 빈 카드는 DB 레코드가 아니므로 데이터 삭제 작업은 없다.


### 2026-09-22 예배 순서 식별값의 실제 저장 계약
- 실제 예배 요소의 순서 식별값은 `source_ref.slotKey`에 저장한다. 아직 없는 `mindex_worship_elements.slot_key` 열을 추측 조회·쓰기하지 않는다.
- 입력·콘티·송출의 `_worshipSlotKey` 어댑터와 기존 JSON 식별값은 유지하며, 가져온 최상위 `slot_key` 값도 저장 전에 `source_ref.slotKey`로 옮긴다. DB 구조나 기존 콘텐츠는 수정하지 않는다.


### 2026-09-23 청년부 주보 초기 통합
- 사용자 요청으로 청년부 예배의 주보 진입점을 활성화한다. 별도 모듈 `mindex.bulletin.js`에서 내용·양식 편집과 A4 양면 인쇄를 제공한다.
- 저장된 예배를 `adopt:false`로 읽어 Presenter의 미저장 내용·저장 기준·송출 상태를 변경하지 않는다. 대표기도자는 교회력 우선이며 방송용 항목은 인쇄에서 제외한다.
- 전용 문구와 배치는 기기 내 초안이다. 화면 저장과 Ctrl/Cmd+S도 주보 초안만 저장한다. 전용 DB·발행 snapshot은 후속 범위이며 기존 예배 필드에 임의 payload를 쓰지 않는다.
- 현재 구현·검증 범위와 후속 설계는 `young-adult-bulletin.md`를 따른다.


### 2026-09-23 주보 자료 비교 반영
- 기존 PDF 72개 비교 결과를 반영해 날짜별 공통 문구 기본값과 기기 내 적용일별 재사용 설정을 제공한다. 확정된 과거 호수만 기본값으로 사용하며 미래 번호를 주차로 계산하지 않는다.
- 일정 월과 위원표 월을 따로 선택한다. 위원표는 월 전체+다음 달 첫 주일이고, 미정/집회 없음도 유지하며 NEXT는 다음 주일을 가리킨다. 예배 목록과 교회력은 읽기 전용으로 다시 조회한다.
- 배경 3종과 프레임별 출력 숨김을 제공한다. 과거 절기 배경 복원과 발행 snapshot/DB 공유 저장은 후속 범위다.
- 저장·복원·undo/redo·인쇄는 배경/표시 월/프레임 숨김을 함께 보존한다.


### 2026-09-23 과거 주보 배경 자산 통합
- 2026년 PDF의 텍스트 없는 배경 5종(오로라·사순절·종려/수난·성령강림·별빛)을 공용 WebP로 저장하고 양식의 배경 선택에 추가한다. 선택은 초안/undo/redo/PDF에 함께 보존한다.
- 종려/성령강림 배경에는 밝은 반투명 패널과 어두운 바깥 글자를 사용해 가독성을 유지한다. 날짜별 자동 전환이나 과거 프레임/로고 복원은 하지 않는다. 원본 위치와 추출 사양은 assets/bulletin/README.md에 기록한다.


### 2026-09-23 주보 배경 중복 제거 (사용자 정정)
- 앞선 별도 추출 결정을 대체한다. 배경 6종은 이미 MINDEX에 있으므로 `assets/worship-backgrounds/26-A1/A2/A3/A5/S4/S6.png`를 직접 참조한다. 중복 WebP 6개를 삭제한다.
- 기존 초안의 theme key는 유지하므로 선택 상태·PDF 동작은 보존된다. RIA 마크는 배경과 별개인 기존 로고 자산으로 남긴다.

### 2026-09-23 실제 주보의 배치·밀도 복원
- 원본 PDF 좌표를 기준으로 제목/월 표시, 환영/소식/상시 안내, 섬김이 표, 균등 자간의 예배순서, NEXT 배지와 위원표 정렬을 보정한다. 공용 배경은 계속 재사용한다.
- 원본형 양식 적용은 배치만 초기화하고 문구를 보존하며 undo를 지원한다. 기존 사용자 배치에 강제로 덮어쓰지 않는다.
- 교회 일정은 인쇄용 수정 필드를 제공한다. DB 원본의 빈 담당자·누락 행사·설교 요점은 재현을 이유로 만들어 넣지 않는다.


### 2026-09-23 삭제한 인용 구절 저장 충돌 수정
- 명시적인 순서 삭제 표시는 저장된 행과 ID가 달라도 같은 slotKey의 기존 내용을 복원하지 않는다. 이로써 삭제한 인용 구절이 보존 단계에서 다시 추가되어 중복 저장 키 검증에 실패하는 문제를 막는다.
- 삭제 표시 없는 누락 내용은 계속 보존하며, 활성 항목끼리의 충돌은 기존 검증에서 차단한다. `tests/test_worship_deleted_slot.cjs`로 두 경우를 함께 검증한다.

### 2026-09-23 프레젠터 상단 도구 한 줄 정리
- 예배 원문 열기, 슬라이드 크기 선택, 청년부 주보 버튼을 하나의 도구막대에 배치한다. 반복 안내 문구와 별도 주보 행을 제거하고 컨트롤 높이를 35px로 통일한다.
- 원문을 열면 편집 영역만 다음 행 전체 너비로 펼친다. 좁은 화면에서도 도구는 한 줄을 유지하고 해당 영역만 가로 스크롤한다.


### 2026-09-23 삭제한 인용 구절 저장 충돌 수정
- 명시적인 순서 삭제 표시는 저장된 행과 ID가 달라도 같은 slotKey의 기존 내용을 복원하지 않는다. 이로써 삭제한 인용 구절이 보존 단계에서 다시 추가되어 중복 저장 키 검증에 실패하는 문제를 막는다.
- 삭제 표시 없는 누락 내용은 계속 보존하며, 활성 항목끼리의 충돌은 기존 검증에서 차단한다. `tests/test_worship_deleted_slot.cjs`로 두 경우를 함께 검증한다.


### 2026-09-24 Setlist hymn numbers from canonical songs
- 역대 콘티의 연결된 곡은 DB `hymn_no`와 메인 제목으로 표시한다. 원문에 번호가 없어도 표시하고, 원문의 이전 번호는 표시용으로 재사용하지 않는다.
- Explicit song IDs are authoritative. Unlinked title matching retains hymn-number validation; manual and excluded special-song titles remain unchanged.

- Setlist hymn numbers use 75% of the song-title font size, on the same baseline and within the same song link.


### 2026-09-25 Setlist audit fixes
- Live setlist metadata includes explicit deletion markers and omits suppressed praise items before numbering. Presentation-only visibility remains independent. Cache version advances to avoid stale metadata.
- Failed song-catalog requests may retry without force; loaded/in-flight requests remain deduplicated. Archive re-entry and refresh already force a reload.
- Corrected canonical song e5759f4b-8de7-4b85-af7d-6713fa23c196 normalized title base to 예수로나의구주삼고e, preserving the thisismystory variant and all linked IDs.

### 2026-10-01 Stored song-form sequence is authoritative
- Default form rules fill an empty sequence when a song is linked. Existing sequences and explicitly cleared sequences are preserved.
- Once stored, automatic/manual origin does not change playback order. Special-hymn rules must not override an item's saved sequence.
- The form input and presenter use the same resolver. Legacy items without a stored sequence retain their default fallback until linked/edited; production worship content is not bulk rewritten.
- Regression coverage includes the monthly special-song mismatch, identical playback across strength values, default materialization, relinking, memo round trips, and explicit clearing.


### 2026-10-01 Bulletin editorial redesign
- User authorized substantial redesign for reader convenience, production workflow, and aesthetics; old InDesign files remain their historical source.
- New October drafts use the editorial four-face layout with clear worship order, sermon notes, and consolidated weekly/monthly information. Existing artwork supplies the cover band.
- Content editing emphasizes weekly news/outline; monthly and common copy are collapsed. Editable preview text focuses its input.
- Design and frames persist in the existing layout payload. No production content or schema migration is required.


### 2026-10-06 Setlist viewing consistency
- Live archive cards read existing `connectedPraise` metadata and fold adjacent members within the same section into one medley row. Numbering counts every song; each member retains its own canonical title and song link. Missing/suppressed members are not recreated, and independent songs are never grouped by title inference.
- Both home and service routes refresh the archive immediately after search changes or song-catalog loading. Service grouping keeps nursery before children, consistent with period viewing, without changing saved service-type order.
- This is a read projection only; worship records, lyrics and presenter output remain unchanged.

### 2026-10-07 Service-opening performance
- After service-item hydration, update the selected presenter through the existing control patch path instead of replacing its entire detail tree. A late response for another service must not redraw the currently selected service.
- Preview scale measurement reads all frame sizes before writing styles. Overlapping text-fit requests share one animation frame; disconnected hosts are discarded and ancestor hosts cover their descendants.
- Startup downloads vendor dependencies alongside app modules but executes them in the original order. Only presenter/output routes preload presenter fonts; other routes load those fonts when CSS actually needs them. Vendor cache URLs stay unchanged.
- Verification: Chromium/WebKit startup ordering, theme first paint, scale controls, output latency, service handoff, linked-song hydration, outline refresh and layout batching tests. Synthetic 150-thumbnail measurement reduced style recalculations from 149 to 2; this is not an end-to-end service latency claim. Production reads were used for profiling with all writes blocked. No persisted worship data or output rules changed.

### 2026-10-07 Compact score index
- Read-only live profiling isolated a cold score-index download: 4.56 seconds of a 4.73-second Wednesday-service preparation in one run. Database requests were not the dominant wait in that sample.
- Keep `assets/hymn-scores/manifest.json` as the unchanged authoring source. Generate `manifest.runtime.json` with `python3 scripts/build_hymn_score_runtime.py`; check drift with `--check`. The form-label updater rebuilds the runtime index after writing the source.
- The runtime index retains exactly the fields consumed by `presenterHymnScoreAssetSlides`. Verify every hymn's rendered projection with `tests/test_hymn_score_runtime.cjs`. All 645 hymns and 5,855 slides preserve URL, title, order and form metadata.
- Version the runtime request with the app release and use normal HTTP caching. Keep in-flight deduplication and failed-load retry. Manifest arrival patches current presenter controls rather than rebuilding the full app; persisted data and playback rules remain unchanged.

### 2026-10-08 Archive numbering with empty slots
- Live worship archive numbering counts existing praise slots before omitting empty rows. Filled slots 1 and 4 remain 1 and 4 when slots 2 and 3 are empty, rather than appearing as 1 and 2. Actual deletion/suppression still removes a slot from numbering.
- The display stage preserves numbering already derived by the live adapter. Historical import numbering remains unchanged. Empty slots break connected-song groups and are not rendered as songs; wholly empty services do not create archive cards.
- Regression coverage: `tests/test_setlist_archive_display.cjs`, connected-view and deletion tests. This changes only the read-only archive projection, not worship records or slide ordering.

### 2026-10-08 Server recovery foundation (catalog verified)
- Preserve multiple server revisions rather than depending on a single overwritten checkpoint or browser storage. History failure must roll back its save; deletion must retain history. Recovery is operator-only and creates a new revision.
- Validate slot uniqueness at the final aggregate boundary, preserving legitimate slot swaps and existing document checks. Do not auto-repair existing data.
- See `docs/worship-integrity-20261008.md` for migration order, real PostgreSQL tests, capacity/backup requirements and remaining work. Installation and the operator-provided read-only catalog are verified; an authorized production smoke test remains deferred because no approved test service is available.

### 2026-10-08 Setlist handoff: homonyms and return navigation
- Keep canonical song titles and explicit links unchanged. Where same-title/same-hymn-number/same-subtitle records have different existing artists, show the known artist as secondary metadata in Praise lists/search and setlist links. Do not invent a label for missing metadata or resolve ambiguous titles automatically.
- Before leaving an archive via service/song links, replace the current common browser-history entry with its search, view mode, month and detail viewport. Back restores that entry. An archive with a search remains the archive rather than becoming the Home global-search page.
- Song selection already creates its destination history entry; clearing the global search updates that entry instead of adding a second visit. No new return button or separate navigation stack.
- Keep `885259ea` empty-slot numbering and existing medley projection unchanged. No DB repair or lyric collection is part of this handoff; the English Goodness of God text remains user-input pending.

### 2026-10-09 Untitled special-song bulk input
- Leave the bulk preparation field empty when a special song has an assignee but no song title. Serializing the assignee alone makes the input parser treat it as a song title.
- Preserve the item's assignee default. Once a title exists, continue rendering `title / assignee`; linked song titles remain authoritative. No stored worship content or existing user drafts are rewritten.


### 2026-10-10 Explicit announcement bold
- Multiple selected lines toggle bold per nonempty line; toggling off removes all
  paired markers while preserving blank lines. Announcement inputs use ⌘B / Ctrl+B
  without a visible B button; the shortcut retains editor focus.
- Paired `**text**` on one line is explicit bold in announcement output only.
  Other Markdown and HTML remain literal; lyrics/scripture are unchanged.
- B controls and Cmd/Ctrl+B update the existing text input/draft path.
- Strip delimiters before output measurement; preserve parentheses sizing and
  existing highlights while escaping source text.
- Historical advertisement changes add markers only where same-date issued
  department PDFs provide font-weight evidence. Preserve original characters,
  keep a pre-change backup, and write through revision-checked aggregate RPC.

### 2026-10-10 Liturgical and announcement weight
- Liturgical body and announcement text use the bundled 500 Medium face in both
  fullscreen and chromakey output. Explicit announcement bold stays 700, so it
  remains visibly distinct from the default body.

### 2026-10-10 Mixed bold selections
- Applying bold to a selection containing complete bold spans removes their
  inner delimiters before wrapping the selection. Avoid nested marker corruption
  and preserve the original visible words. Shared bulletin editing uses this rule.

### 2026-10-10 Third-service hymn linkage
- Saving a changed first/second-service `praise.song.3` also updates the same-date
  ordinary third-service `hymn.main`. The third service's own `praise.song.3`
  remains independent; editing its hymn does not propagate back to services 1/2.
- An existing empty hymn can receive the initial selection. Separate content,
  unsaved edits, live presentation, custom media and all-generation services
  retain their existing protection. No missing target elements are created.
- Verified dispatch, target identity and conflict guards with
  `tests/test_sunday_third_hymn_sync.cjs`, plus the worship rule guard suite.

### 2026-10-11 Youth worship order
- From service date 2026-10-11, youth worship follows sermon, response prayer,
  Lords Prayer, announcements/fellowship, then second-part class activities.
- Reuse the existing response_song, lords_prayer, announcements and fellowship
  sections; only move Lords Prayer before announcements. Preserve authored text,
  assignees and media. Earlier service dates retain the previous order.
- User explicitly authorized applying this to already-created services from today.

### 2026-10-11 Bulletin-style announcement anchors
- Fullscreen announcement slides with an authored department welcome or footer
  use stable top welcome, middle weekly-news, and bottom recurring-notice zones.
  Existing slide backgrounds and the upper-right 광고 heading remain in place.
- Recognize department welcome copy and explicit ◇/◈/◆/♢ footer markers; known
  recurring notices also retain their footer role. A changed footer sentence
  keeps its placement through the marker, without hardcoding its full wording.
  Unknown text remains news; missing greetings/notices are not synthesized.
- Preserve explicit bold, parentheses, numbering, and source records. Measure
  each zone independently for long text and font loading; thumbnails and output
  share the same renderer. Chromakey chunking and ordinary liturgy are unchanged.
- Verified with `tests/smoke_announcement_regions.cjs` and existing inline-bold
  output tests in Chromium. No production data rewrite is needed.

## 2026-10-11 — Hard chromakey tab corners

- Keep rounded scripture-reference and assignee tabs in chromakey output.
  Draw only their white panel with an inline SVG alpha threshold (0 or 1),
  rather than CSS border-radius blending white against green. Each instance
  owns a unique filter ID, including multiple controller thumbnails.
- Keep glyph antialiasing, tab text, dimensions and fullscreen styling intact.
- Browser pixel checks cover Chromium/WebKit at 1280×720, 1920×1080,
  3840×2160 and 1920×1080 at device scale 2. External capture scaling, video
  compression and fractional-size compositing can still mix edge colors;
  this is not a guarantee for arbitrary downstream keyers. A separate
  1366-wide WebKit probe still showed mixed pixels at fractional geometry.
- No service data or output-control state changes.

### 2026-10-11 Explicit announcement region editor
- Announcement preparation and service editors show weekly news immediately.
  Welcome and footer fields live inside a collapsed common-copy disclosure.
- Persist `announcementRegions: {welcome, news, footer}` in the existing element
  config via memo serialization and the atomic save adapter. Keep the joined
  raw body/slides for existing document and chromakey consumers. No schema change.
- Legacy announcements derive initial fields from the previous recognition rules.
  Once edited, explicit region values, including blanks, own output placement;
  arbitrary welcome/footer wording no longer requires a recognized prefix or ◇.
  Editing a whole raw body through legacy paths clears stale explicit regions.
- The existing input/draft/save path handles each field. Loading alone does not
  write production records. Verified editable common copy, config/read-adapter
  round trip, arbitrary wording, explicit blanks, bold and output regression.

### 2026-10-11 Announcement output weight
- Advertisement output uses 600 SemiBold for regular copy and 800 ExtraBold for
  explicit Markdown emphasis, including fixed regions and chromakey body text.
  Supersedes the earlier advertisement 500/700 rule. The 광고 heading remains
  800; editing controls and other liturgical text retain their existing weights.

### 2026-10-11 Welcome text size
- Fullscreen announcement welcome copy uses the same 4cqh base size as weekly
  news. Preserve its top anchor, heading clearance, 600/800 weights, and fitting
  for unusually long copy. Footer sizing remains unchanged.

### 2026-10-11 Announcement list typing
- Weekly-news inputs display sequential circled numbers and indent unnumbered
  continuation lines. Enter inserts the next number; Shift+Enter continues the
  current item. Enter on an empty numbered row exits the list. Pasted copy is
  normalized and middle insertions renumber later items. IME composition and
  modified save shortcuts are not intercepted. Welcome/footer fields are unchanged.
- The presenter removes the editor's continuation-space prefix before applying
  its own hanging indent so output does not acquire a double indent.

### 2026-10-11 First announcement number
- In an empty weekly-news input, the first inserted content gains ① immediately.
  Deleting all content leaves the input empty. During Korean IME composition,
  defer numbering until composition completes and keep the caret after the text.
  Welcome/footer inputs do not receive automatic numbers.

### 2026-10-11 Renumber after deleting announcement items
- Weekly-news deletion (including selection deletion/cut) immediately renumbers
  surviving numbered rows. Keep unnumbered continuation content and the deletion
  caret position; do not recreate a deliberately removed marker or cleared text.
  Exiting an empty numbered item also renumbers subsequent items. Ignore deletion
  events during active IME composition.
## 2026-10-11 — Number zero means blackout

- Entering slide number `0` uses the existing safetyBlank transport state but
  renders solid black immediately, in both chromakey and fullscreen services.
  Do not display the service background or decorative blank cross.
- Keep the previous slide index; ordinary number/next/previous navigation exits
  blackout through the existing navigation rules. Regular in-sequence blank
  slides retain their existing background/keying behavior. No stored data changes.

## 2026-10-11 — Desktop update safety

- Installed-app updates retain `electron-updater`; no Sparkle integration.
- Defer update prompts while presenter output is open; the main process blocks
  installation independently of renderer state. Number-zero blackout is still
  active output and does not permit installation. No install-on-quit behavior.
- Require explicit download and restart actions, with unsaved/save-in-progress
  protection and a native update menu for retry/later. See
  `electron-packaging-plan.md` for platform-specific build and release gates.

### 2026-10-11 Announcement numbering audit
- Parse numbered rows through the shared inline-text helper, including a marker
  inside `**bold**`. Keep emphasis on the body without duplicate output markers;
  preserve authored output spacing and editor continuation indentation.
- Enter at the start of an item inserts a preceding item without duplicating its
  marker; Enter replaces a selected range. Mobile beforeinput paragraph/line-break
  events add the next item. Desktop Shift+Enter remains continuation indentation.
- Keep bounded per-input undo/redo snapshots for native edits, numbering,
  composition completion and bold toggles. Restore text and selection together,
  including deletion followed by automatic renumbering. Common fields are unchanged.
- Chrome checks cover insertion/deletion, paste, Korean composition events,
  styled numbers, undo/redo, mobile beforeinput events, 20+ items, blank lines,
  persistence round-trip and output. Mobile events are simulated, not device-tested.

### 2026-10-11 Announcement editor content height
- All three announcement inputs use the same content-sized height, with a single
  line minimum and shared padding. Remove region-specific row counts and manual
  resize handles. Grow/shrink with input and wrapping, including reopened common
  fields; cap at 55vh with internal scrolling for unusually long copy.

### 2026-10-11 Young-adult prayer meeting time
- User correction: the Saturday prayer meeting changes from 3 PM to 10:30 AM
  effective 2026-10-01. Date-based bulletin defaults follow this boundary; retain
  earlier archive-documented time transitions. The October 4 announcement and
  saved bulletin were corrected with revision checks; September remains 3 PM
  and October 11 already contained 10:30 AM.

### 2026-10-11 Persisted medley member identities
- Resolve `connectedPraise.primaryItemId` and `itemIds` to the final element IDs after save-row allocation, in both config and source_ref. Preserve group identity, order, roles and titles without mutating editor drafts.
- Partial saves remap only emitted rows and preserve references to other persisted members. Existing worship content is not bulk rewritten.
- Coverage: `tests/smoke_medley_persistence_ids.py` exercises new IDs, reload/resave, isolated patches and independent songs in Chromium/WebKit.

### 2026-10-13 Desktop shell and print boundary
- All window sizes use one 50px header and persistent 260px navigation sidebar.
  Retire the mobile drawer, portrait sidebar, and automatic collapse state.
- Preserve input wrapping and panel-local scrolling. Below the usable canvas
  minimum, allow page scrolling rather than overlaying panels or hiding controls.
- Apply the shell minimum width only to screen media. The current bulletin
  editor prints through its separate A4 landscape frame and does not inherit
  app-shell CSS. Retired service-bulletin styles were removed on latest main;
  do not restore that obsolete path for print compatibility.
- Shell regressions now live in `tests/smoke_shell_tabs.py` and
  `tests/smoke_sidebar_shell_alignment.py`; no test should call retired drawer
  handlers. Narrow-window tests assert panel bounds and intentional canvas scroll.
- Verification: bulletin resolver/input contract Node tests and Python syntax
  checks passed. CUA verified shell geometry and active-tab visibility at
  390/560/900/1280px. Safari's native print preview showed the current bulletin
  fixture as two A4 landscape pages (orientation selected in the print dialog).
  `tests/smoke_bulletin_shell_print.py` preserves the current print iframe
  isolation, two-page A4 dimensions, and unchanged screen canvas coverage. The full Python browser smoke suite and physical printing were not
  run in this pass; browser checks used CUA.

### 2026-10-13 Linked-song loading and worship action performance
- Fetch missing song metadata concurrently with relational version/unit data. Publish relational data after metadata resolves; retain in-flight deduplication, explicit retry and unresolved-link save protection.
- Reuse the existing synchronous service-item projection scope during item actions and dirty fingerprints. Array replacement still invalidates the projection, and the outer scope clears it before later edits.
- Chromium/WebKit coverage retains retry, late-response isolation and medley persistence IDs. Controlled deferred-fetch coverage checks parallel loading, publication ordering, warm cache and unit-failure retry.
- Read-only sample (28 items, 10 linked songs): add-action projections fell from five to two; measured add time fell from 219/264 ms to 176/245 ms. Network timings vary and are not a latency guarantee.


## Runtime-only cleanup — 2026-10-13

Retired unused wrappers and legacy shared-content copy helpers. Tests now use
`applySundayEditSync`, `buildWorshipPersistenceRows`, service-aware preparation
defaults, current display names and `presenterSlideOutputContext`. Existing
sync conflict/draft guards remain authoritative. Slide-model diagnostics that
only aggregate validation results belong in tests; production single-slide
validation stays in place. Scheduling only creates missing instances and never
automatically deletes an existing service after calendar changes.

### 2026-10-13 Complete browser regression audit
- Ran all 169 Playwright-backed test entry points on e5c9146c, then reran failures
  individually after diagnosis. Final per-file results have no failures. Real
  Supabase scenarios in `smoke_app.py` and `smoke_worship_presenter.py` remain
  skipped; all runs used isolated browser profiles and blocked external traffic.
- Remove a newly inserted, empty reference-media item when image persistence
  fails. Asset kind alone is not content; retain successful assets and concurrent
  edits. The image batch rollback regression now passes in Chromium and WebKit.
- Manual DB refresh no longer writes the retired worship-row cache using the
  deleted `worshipRowsCacheKey` helper. Detached snapshot refresh and failure
  guards pass in both browser engines.
- Align test fixtures with the current desktop canvas, module switcher, compact
  preview status row, announcement region fields, and active output layer.
  Wait for full app boot before testing module functions that load before state.
  Ignore closed details when checking painted control overlaps. Preserve
  overscan coverage rather than requiring a mathematically exact preview edge.
- The compact preview header introduced on October 11 supersedes the fixed
  status slot above: healthy output uses the title row; video errors/loading add
  a bounded status row, stable across error states, then collapse on recovery.
  Draft focus, selection, retry action, and narrow-panel containment remain tested.
- `MINDEX_SMOKE_OFFLINE=1` removes embedded Supabase configuration only from the
  local Python smoke server response and disables environment credential lookup.
  It does not modify shipped configuration or replace external network isolation.
- Bulletin coverage passes save failures, revision conflicts, local recovery,
  draft reload, responsive control reachability, duplicate-print prevention and
  two-page A4 landscape iframe isolation. No printer job or production write ran.
- After integrating main through a9f48e5f, reran all 169 browser entry points
  on the combined code: 169 successful, zero failures, with the same two live-DB
  scenario groups explicitly skipped. Web cache version: `20261013-browser-audit`.

### 2026-10-13 Integrity remediation
- Worship song picker reuses the existing homonym artist hint without changing
  stored titles, artists, IDs, or automatic matching. Missing credits stay blank.
- Content audit validates both current NFKC/whitespace-normalized canonical keys
  and historical punctuation-free import keys. A wrong title base is still an
  error; neither representation triggers a data rewrite. Song identity includes
  the existing artist, matching the UI's homonym distinction.
- The October 11 afternoon service source explicitly orders announcements,
  ceremony, sending, closing. Three section sort numbers were repaired through
  the atomic client under expected revision 34; revision 35 was read back with
  identical elements, slides and source document. No schema or permission change.
- History compaction SQL uses a correlated SET subquery rather than an invalid
  UPDATE target reference in FROM LATERAL. Verified in disposable databases only;
  this migration was not applied to production.
- Six offline browser fixtures now explicitly set the mock client/session and
  clear the offline connection error rather than relying on shipped configuration.
- Video retry smoke now serves valid HTTP 206 byte ranges. Returning the whole
  MP4 with HTTP 200 for offset requests left Chromium loading indefinitely; the
  fixture now verifies recovery without weakening playback assertions.

### 2026-10-13 Outline assignees
- Presenter sidebar child rows show title / assignee using the same assignee
  resolver as the editor. Missing assignees leave titles unchanged; person-only
  rows and prayer summaries do not repeat names. Full text stays available in
  the tooltip and accessible label. This changes display only, not saved items
  or output slides.

### 2026-10-13 Background-ready output swaps
- Service backgrounds participate in the output image decode gate, including
  clean special-song screens in a chromakey service. Preserve the active frame
  and its output context until a background source is ready. Failed loading
  retains the previous frame; later navigation/blackout invalidates pending work.
- Regression uses a one-second delayed background and checks rendered pixels,
  then verifies late completion cannot replace an explicit blackout.

### 2026-10-13 Reuse decoded output backgrounds
- Live-data click verification still found a dark first special-song frame after
  the decode gate: applying the source URL to CSS could request/decode it again.
- Output now attaches the already decoded image nodes behind the slide layers,
  preserving CSS source stacking and centered 100%-width sizing. Other contexts
  remove the layer; blackout remains immediate. Preview CSS behavior is unchanged.
- Verified the October 11 third-service scripture-to-special-song UI transition
  using read-only production data, including first-use/cold-cache screenshots.

### 2026-10-14 Video first-frame warmup
- Keep the intentional black loading fallback for videos. Output warms the next
  video within the existing 12-slide lookahead with preload=auto, without play()
  or seeking. Save-data/2G skip behavior and the two-entry cache limit remain.
  Controller preparation retains metadata-only loading.
- When the cached video has a decoded first frame, consume that same paused
  time-zero node into the output layer without resetting src or calling load().
  Apply the selected slide's mute, autoplay, loop and controls configuration.
  Cache cleanup must never unload the consumed active video.
- Chromium/WebKit first-frame smoke verifies readiness, no preselection playback,
  manual playback, autoplay after selection, and active-node cache ownership.

### 2026-10-14 Background smoke contract correction
- A missing/unregistered clean-output background is black, not an inferred
  fallback theme. The full smoke now checks that behavior and separately
  restores the registered asset to verify a decoded image node with no CSS
  image reload. Checks inspect the active output layer.

### 2026-10-14 Hymn scripture reference search
- Recognized Bible addresses search song scripture metadata by canonical book and
  chapter, with inclusive verse-range overlap. Chapter-only queries match any
  stored verse in the chapter; exact verse/range matches rank first.
- Reuse the Bible alias parser for abbreviated/full Korean and English names,
  compact addresses, and written chapter/verse notation, including Psalms 편.
  Keep John separate from 1 John and exclude unrelated title/lyric substring hits
  for recognized addresses. Ordinary title, lyrics and hymn-number search remain.
- Cache parsed queries and stored references; existing search-cache invalidation
  and Bible-book replacement invalidate parsed references without extra reads.
- Chromium/WebKit regressions cover abbreviations, written notation, range edges,
  wrong books/chapters, cache updates, and existing global/cold/loading searches.
- Read-only live-data validation: all 639 referenced hymns passed 3,195 full,
  abbreviated, written, interior-verse and overlapping-range queries per browser,
  plus 10 actual search-input cases. The six Amen hymns retain empty references.

### 2026-10-14 Service song search selection list
- Song-title input previews matching candidates after a 150 ms typing debounce,
  including ambiguous scripture references. Replace only the picker, preserving
  input focus, draft service records and current presenter output. Existing click
  selection and explicit commit/save behavior remain responsible for linking.
- Preview uses an unlinked copy of the input draft even when replacing a linked
  song. Clear input restores the hint; unmatched queries show no results.
- A cold catalog uses the existing shared search-only loader. Completion reads
  the latest input and ignores detached fields, changed services or replaced rows.
- Chromium/WebKit cover multiple-result display and click selection, scripture
  ranges, focus, draft/output isolation, empty/no-result queries and cold loading.
  Actual production hymn records were also checked in an unsaved test service;
  all persistence requests were blocked and no real service was changed.

## PPTX insertion and basic effects (2026-10-14)

- Worship/Presenter section **추가 → PPT 삽입** accepts an unencrypted `.pptx`,
  at most 500 MiB / 300 pages. Existing `.key` / `.ppt` desktop image-stage import
  is unchanged. A connected PPT has a **PPT 교체** action.
- Inspection and thumbnails are local. Before uploading, show page count,
  renderer limitations and confirmation that the original file (including notes
  and hidden pages) plus PNG thumbnails go to the existing public worship media
  bucket. No production fixtures are uploaded by tests; no storage policy or
  schema change accompanies this feature. Do not silently strip media or alter
  the original file to fit storage limits.
- Sources up to 50 MiB keep the direct `.pptx` URL. Larger sources use immutable
  16 MiB binary objects plus `source.pptx.parts.json` in the same bucket. The
  existing `pptx.url` points to this transport manifest (`mindex-pptx-parts-v1`,
  total size, ordered parts with URL/size/SHA-256); no second asset model or DB
  schema is introduced. Each storage object remains below the 50 MiB limit.
  Readers validate the manifest bounds, same-origin unique part URLs, exact
  part lengths and SHA-256 before parsing the reassembled original bytes.
  Downloads are sequential, bounded and timed out; failures retain the previous
  live frame and use the existing error/retry path. The source cache deduplicates
  both direct and multipart sources. Upload progress is shown for large files.
  Partial upload cleanup and uncertain atomic-save retention apply to all parts,
  the manifest and thumbnails together.
- Persist an existing `imported_deck` asset with `pptx.url`, and per-thumbnail
  `pptx: {page, clicks, hidden, mediaCount?}`. The source URL is immutable per upload. These
  fields survive canonical config/source/document normalization. Import targets
  one element via `saveServiceItemMutation` and its atomic revision path.
  Concurrent edits abort replacement. Pre-save upload failures remove only new
  files; after an uncertain save, keep immutable files and the pending draft
  for the existing reconciliation/retry workflow.
- Each PPT page remains one numbered Mindex slide. Next consumes click-effect
  groups before moving on; previous rewinds consumed clicks before moving to
  the previous page. Direct jumps start that page again; invalid jumps do not
  change progress. Original hidden pages are skipped by normal navigation.
  Zero remains immediate black, and leaving a page destroys its effect session.
- `pptxProgress` is transient navigation state, shared by compact transport,
  standalone output controls and controller recovery. It is not an operational
  DB edit. Thumbnail/editor selection remains separate from live output.
- Explicit OOXML automatic-start entrance groups run on entry without an extra
  click. Zero-duration appearance stays instantaneous, including delayed items
  within the click batch. Basic effects use web-ppt 0.4.5 plus the recorded fixes;
  media play/pause commands are timed separately from visual effects.
  Automatic page advancement and hyperlinks do not bypass Mindex controls.
- This is a subset renderer, not PowerPoint parity. Unsupported media codecs,
  complex effects, original slide transitions and exact font/layout fidelity
  are not guaranteed. The controller shows a **PPT 정지 미리보기** with consumed
  click count; the output alone plays effects. Always preview a real deck before
  service use. Legacy native stage imports retain their original behavior.
- Upcoming PPT files are prefetched near the active page. Parsed source requests
  are deduplicated; retain at most two idle decks plus active sessions. First
  frame image decoding holds the previous live frame. Stale loads cannot replace
  a newer slide/blackout; errors clear busy state and reach the controller.
- Verification: `tests/smoke_pptx.py` covers insertion/replacement, model round
  trip, atomic-save boundary, upload cleanup, uncertain-save retention, click/
  automatic/instant playback, rewind, repeated messages, blackout and delayed
  loads in Chromium and WebKit. Synthetic fixtures never use the production DB.
  Real local RIA_2026-07-26 (43 pages) and TOV_2026-07-12 (52 pages) passed full
  thumbnail generation and mocked upload/save in both engines. Selected effect
  pages from Elem_2026-08-09 and 어린이부 예배 2025-12-14 also passed output
  playback in the original integration audit. Large-file insertion is covered
  by `tests/smoke_pptx_large.py`: full import, exact original-byte reconstruction,
  click playback, corrupt/missing parts, foreign URLs, size limits, partial
  cleanup and uncertain-save retention. Tests use isolated storage/save doubles;
  real source files and operational records are never modified.

- Large-source acceptance: Elem_2026-08-09 (171,690,294 bytes, 96 pages) and
  어린이부 예배 2025-12-14 (168,362,655 bytes, 30 pages) both passed full
  insertion, all thumbnail uploads to isolated storage, exact SHA-256 source
  reconstruction and selected click-effect playback in Chromium and WebKit.
  Each source used 11 parts plus one manifest; the atomic save ran once per
  insertion. Original local-file hashes remained unchanged. This verifies the
  application path, not a real production upload or mixer hardware.

### 2026-10-14 Loading, navigation and selection-save performance
- Measured all eight primary modules on Chromium/WebKit: cold startup about
  2.9–3.7 s, first praise load 2.0–2.3 s, and warm route paint mostly tens to
  hundreds of milliseconds. Worship detail and write paths need separate checks.
- Song catalog loading now paints title/metadata rows before all version lyrics
  arrive; catalog-complete status still waits for full hydration. Existing
  search-only isolation, shared requests and final version publication remain.
- Controller browsing no longer issues a full prefetch of the roughly 27 MB
  ready-loop video. Output retains its own loading/playback/first-frame handling.
- Page-tab visibility geometry runs once in the next animation frame, after DOM
  updates, instead of forcing layout midway through each shell render.
- Candidate pointer selection prevents the input blur from saving a tentative
  query before the chosen song. A committed candidate consumes that field's
  pending text draft before rerendering; the normal explicit selection save runs
  once. Enter/manual edits retain their existing commit behavior.
- Tests cover single-save candidate clicks, delayed-lyrics list visibility,
  controller prefetch absence, tab visibility, output first-frame/autoplay, global
  searches and loading isolation. Operational saves use only a uniquely named
  disposable test service; other service IDs/revisions are compared unchanged.
- With production data and the revised local client, four candidate selections
  each issued one atomic save (previously one or two), with read-back confirmation
  around 0.55–0.70 s in this run. Fresh-context song/version/element IDs matched.
  These are sampled timings, not a latency guarantee across networks/devices.

## PPT embedded video and audio (2026-10-14)

- Embedded sources use their existing package blob URLs. Only the live output
  instantiates native media players; thumbnails/controller previews remain
  silent images. SVG geometry retains the media's original position and size.
  Prepare decoded first frames before the output swap; do not substitute badges
  or silently advance when a file fails to decode. No media is separately
  uploaded, recompressed or removed from the original PPT.
- Main-sequence `playFrom(seconds)`, `play`, `pause`, `togglePause` and `stop`
  commands participate in Next click grouping and explicit automatic starts.
  Media commands never become fade/emphasis effects. Object-click interactive
  sequences do not become extra Next clicks. Node volume, mute and indefinite
  repeat are honored. Browser-supported codecs are required (tested MP4 and
  WAV); the playback-conditions section below extends object clicks, trimming, repeats,
  slide-spanning audio and media-end timing. Other unsupported PowerPoint
  effects remain outside this renderer’s scope. See Microsoft's [OOXML Command contract](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.command).
- The live PPT preview offers **PPT 영상·음원 재생 / 일시정지** when the current
  page contains media. A transient, uniquely identified command travels inside
  `pptxProgress`, scoped to its source/page key. Duplicate payloads preserve
  playback position. Manual play resumes all media on that page; pause cancels
  pending media timers. It does not save operational data.
- Leaving the page pauses local media except explicitly spanning audio (below).
  Live scripture takeover, blackout and output teardown pause
  media and cancel delayed starts immediately, before any visual crossfade.
  Destroy releases player sources before parsed-deck eviction. Rewind restores
  visual effect state with media paused, rather than replaying consumed sounds.
- Playback rejection is reported to the controller. If a browser blocks sound,
  Space in the output retries directly within the key gesture, consuming that
  key without advancing the slide. Do not disguise blocked audio as successful
  muted playback. See [play() and autoplay restrictions](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).
- Previously saved PPTs require no replacement or DB backfill: output parsing
  supplies current page click/media counts through the existing heartbeat; the
  controller updates only its runtime slide metadata. New imports persist the
  optional media count in the existing asset. Changed vendored ESM dependencies
  use an explicit media1 URL revision so an older cached parser is not reused.
- `tests/smoke_pptx_media.py` covers native WAV decoding/playback, automatic and
  click commands, volume/repeat, duplicate state, explicit pause/resume, policy
  recovery, legacy metadata, rewind and delayed-start cancellation on blackout
  in Chromium/WebKit. Actual local children's PPT video pages (2026-08-09 page
  88 and 2025-12-14 page 4) played in both engines at 1920×1080/1280×720, with
  original 80% volume and click ordering; screenshots were visually inspected.
  Production writes and church-file uploads were blocked; mixer/speaker
  hardware output is not claimed as verified.

### 2026-10-14 Startup and worship detail read latency
- Read the lightweight service view immediately alongside service types. Its
  successful response proves alias-column support without a preceding probe;
  legacy table/column detection and offline cache fallback remain available.
- Warm the atomic client module alongside initial service-list reads. This only
  imports code, never reads or writes an aggregate. Failed imports remain retryable.
- Initial detail hydration adopts full source/document history and rows from the
  same atomic aggregate read; it no longer fetches source_ref separately first.
  Already-loaded partial records and pre-save full-document guards remain intact.
- Repeated praise title matching reuses normalized names in a weak cache, keyed
  by the current title/version-name signature. In-place edits invalidate it;
  homonym selection priority and song/version IDs are unchanged.
- Local Chromium CPU sampling of four repeated detail renders reduced sampled
  title-matching time from about 94 ms to 13 ms. This is a bounded CPU profile,
  not a promise about network or total page latency.
- Tests cover empty-view success, legacy/offline fallback, in-place name changes,
  one aggregate request, full-history adoption, loading reentry, refresh/draft
  isolation, picker selections and medley persistence. Operational timing runs
  block all writes and compare existing service IDs/revisions before and after.

## PPT playback conditions and spanning audio (2026-10-14)

- Honor `cMediaNode.numSld` for audio across forward pages of the same imported
  item/source/service. Preserve the actual native player and its time, volume,
  pause state and decoded source; do not restart from zero at a visual swap.
  Pin the parsed deck while its blob URLs are in use. Page span includes the
  source page. Reverse navigation, leaving the span/item/service, non-PPT
  output, live scripture, blackout and failed page loading stop carried audio.
  A direct jump into a later page does not invent/replay an unheard prior track.
- Current-page metadata includes carried audio, so existing play/pause controls
  remain available on pages without their own media. Preview remains silent.
  Manual pause cancels pending starts; explicit resume continues current time.
  Browser sound blocking remains visible and Space recovery includes carried
  tracks. No new saved playback state or production backfill is introduced.
- Parse Office media trim as removed start/end durations (milliseconds by
  default, also h/min/s/ms/µs/ns). Prepare the trimmed first frame before showing
  the page. Repetition uses the trimmed segment and honors thousandths-based
  finite repeat counts, indefinite repeat and explicit repeat duration. End
  dependencies wait for actual completed playback, including repeats/pauses,
  rather than a guessed duration or a zero-duration visual effect.
- Keep object-click sequences separate from Next groups. The output’s target
  object supports click/Enter/Space for its media command. Main Next navigation
  preserves existing click groups; duplicate payloads do not replay commands.
- Primary references: [media span](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.commonmedianode),
  [trim](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.office2010.powerpoint.mediatrim),
  [time units](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-pptx/a3ead080-d9cb-4b4a-8014-6d815248c23b),
  [repeat timing](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.commontimenode).
- Verification: `smoke_pptx_conditions.py` exercises native cross-page audio,
  identity/time continuity, cache pinning, range stop, manual controls, reverse
  navigation/service/scripture/blackout stop, trim, finite repeat, duration
  limit, separate interactive click and completed-media entrance in Chromium
  and WebKit. Existing media/import/large-source tests remain required.
- Real unchanged local children's decks (2026-08-09 p88 and 2025-12-14 p4) were
  parsed and played in both engines, including their original object-click
  pause and keyboard resume. A read-only scan of 57 locally available worship
  PPTs found no spanning-audio/trim/repeat example: those cases use explicit
  synthetic OOXML fixtures, not a claim about the original church decks.
  Church files were neither uploaded nor modified; no operational DB writes.
  Physical mixer/speaker acceptance remains unverified.
### 2026-10-14 Praise input mode preserves chosen versions
- Switching between score/lyrics loading is a presentation-mode change, not a
  new song selection. Keep the linked song and an eligible explicitly selected
  version; choose a default only when the fully hydrated catalog proves that
  version is unavailable for the target mode.
- Missing/partially hydrated catalog rows retain saved IDs. Manual praise still
  deliberately unlinks the DB song/version. Medley metadata remains intact.
- `smoke_praise_mode_switch.py` reproduces the old score-to-lyrics version reset
  and covers compatible/incompatible versions, DB row roundtrip, medley retention,
  missing/partial catalog and manual unlink in Chromium/WebKit without DB writes.

- Native service-item selects commit on `change` only: their preceding `input`
  event must neither rebuild the control nor issue a duplicate save. Text-input
  preview/commit rules remain unchanged.
- Grouped preparation rows display the linked song title from the editor model,
  matching individual rows; empty canonical raw_title no longer looks unlinked.
- `smoke_praise_mode_ui.py` clicks real controls in both engines and verifies one
  save per mode change, stable version/title, and non-overlapping contained
  controls at 1440/1024/768 px. A production-page run uses isolated browser state;
  persistence verification uses only a uniquely named disposable test service.


## Explicit all-generation default isolation (2026-10-14)

- User reported regular third-service defaults such as `할렐루야 찬양대`
  and `내 한 가지 소원` appearing in an all-generation service.
- For an existing `sunday-main` service, an explicit `all_generations` source
  variant or exact `온세대 찬양예배` alias selects its all-generation template
  even before calendar hydration. Other types, free-form titles, notes and
  substring aliases do not grant that explicit designation. Calendar-based
  designation remains supported. Automatic service scheduling and department
  skip decisions still require the calendar's church_schedule, not an alias.
- Before projection matching, omit untouched regular-only slots, including
  entrance praise, and clear the exact inherited regular choir assignee from
  an untouched special-song slot. Keep the special-song slot itself. Cleaning
  before matching prevents an old entrance slot becoming another praise slot.
- Respect element/section template_modified flags and preserve explicitly
  edited content, other assignees, and song/version choices. Projection creates
  new objects; it does not patch operational records or rewrite old services.
- `tests/smoke_all_generation_defaults.py` verifies empty-calendar explicit
  aliases, persisted variants, fresh scaffolds, inherited regular defaults,
  repeated projection, edited-content preservation, original-object immutability
  and calendar-only automatic scheduling in Chromium/WebKit. Network writes
  are blocked; no production cleanup/backfill is included.

### 2026-10-14 Elem manual song timing integration

- Add manual per-page audio timing to linked-song lyric presenter groups. Save audio bytes and timings in a separate IndexedDB store (`mindex-song-timing-v1`), keyed by song and effective version ID; never update song, version, service memo, medley or ordering records.
- This first integration is browser-local. It does not upload audio, import Elem library data, or sync devices. The editor explicitly labels this boundary. Closing without saving discards edits.
- Exact normalized lyric/page content validates timing; changed lyrics, form sequence or pagination blocks local automatic advance until recalibrated. SHA-256 of a replacement audio file resets timing unless the bytes match. Do not infer timestamps or silently repair reversed times.
- All pages must have finite ordered timestamps within decoded audio duration, with a 0.2-second minimum gap between both recorded times and effective cues. Lyrics advance one second early; blank/music-note pages have no lead. Final lyrics remain until manual navigation (no automatic postlude/cross insertion in this phase).
- Reuse controller audio playback, source/group isolation, blank/live-scripture guards. Manual navigation pauses local synchronized playback; pause/seek/stop use the existing audio clock. Disabled/stale local profiles cannot fall back to an older asset timeline.
- Local timing revision participates in presenter slide-cache invalidation. Adding timing never changes service item identity, order, version selection or connected-praise metadata. Legacy synced_lyrics assets retain their existing support.
- Verification: `test_song_timing.cjs` plus medley bulk-paste, main-praise slot normalization, worship input application and title-disambiguation unit suites passed. `smoke_song_timing.py` passed Chromium and WebKit with decoded synthetic WAV playback, manual timestamp recording, save/reload, disable/re-enable, source/group isolation, backward seek, pause, manual navigation, stale-lyrics/audio replacement and unchanged source records. Existing content-identity and medley delete/reorder save smokes passed both engines. Browser requests were restricted to the isolated local server/Blob URLs; no production service or song write, deployment or library import occurred.

### 2026-10-14 Cross-computer song timing sharing

- Shared Save / Load reuse the existing public `mindex-worship-media` Storage bucket, under `song-timing/v1/<SHA-256 of song/version key>/`. No schema, policy, song/version, medley or worship record changes. UI explicitly describes public-link access and the combined 50 MiB limit.
- Each save uploads one immutable uniquely named binary bundle containing exact audio bytes and timing metadata. Never overwrite or delete earlier shared versions. A second computer explicitly loads the newest server-created version and persists it to its own IndexedDB for offline reopening. Existing local data is not uploaded automatically.
- Validate format/version, header and total bounds, exact song/version identity, exact lyric pagination, audio byte count/SHA-256, decoded duration and ordered cues before installing an incoming bundle. Failure leaves the current local profile untouched. Replacing an existing draft requires confirmation in the editor.
- Shared-save failure retains the previous shared object and reports separately when the local save succeeded. Shared operations disable editing until completion and recheck the currently selected element identity/content after asynchronous work.
- Verification: unit bundle roundtrip/wrong-song/stale-lyrics/corruption rejection, plus Chromium/WebKit with independent browser contexts and an isolated Storage double: share/load, local reload, real controller playback/automatic advance, corrupt download and failed upload preservation; unchanged song/service fixtures.



## Service-local media within song progression (2026-10-14)

- `송폼 배경 사진` replaces the selected rendered form occurrence's background,
  not the following position. Repeated `Int`/`C` labels are distinguished by their
  sequence position. Lyrics retain their caption bar over the photo; an instrumental shows photos
  alone, without the clean-blank cross. The next form restores its own context.
  This supersedes the initial same-day after-form insertion design.
- Keep Praise versions/forms unchanged. The existing element `config` stores
  `mediaPlacement: { parentItemId, formKey, signature }`; memo is its UI adapter.
  Resolve temporary parent IDs when building atomic persistence rows. No new
  table, schema migration, parallel asset store, or production backfill.
- The signature covers song/version, output mode, the complete rendered form
  sequence, and manual slide content. If it no longer matches, the parent is
  absent, or the sections differ, preserve the files and exclude their slides
  from output until the operator reselects the location or detaches the media.
  Hiding the parent also hides attached media. Nested placements are unsupported.
- Reuse ordinary image bundle storage and decoded background rendering. The
  selected form emits max(lyric page count, photo count) frames, traversing both
  lists in order and holding the shorter list's page. No lyric/photo is discarded
  or repeated as a whole sequence. Next/Previous and numeric navigation remain
  the normal controls. Audio-timed advance stops at these operator-controlled
  frames in either seek direction. The board follows playback order.
- Only images can be uploaded as form backgrounds. Non-image assets or score
  forms remain preserved but excluded with a warning; detach permits ordinary
  media playback. Do not silently replace score artwork. Image decode gates and
  warmup include form backgrounds; previews share the exact background policy.
  Safety blackout always removes the image and remains black.
- Reference media never consumes a song/template slot. Existing sermon,
  announcement and offering media slots retain their established keys; media in
  other sections uses its ordinary element identity without a template slot.
- The existing image bundle editor supports ordering/removal without deleting
  remote blobs. These edits use normal service save. Uploads use the atomic
  mutation path; after a save has been attempted, retain blobs and the draft on
  errors because an unknown outcome may already have committed.
- Offline Chromium/WebKit coverage: `smoke_progression_media.py` (repeated
  interludes, multi-chunk forms, board order, row roundtrip, stale/orphan/hidden
  guards and native UI controls), `smoke_progression_media_save.py` (full and
  partial atomic saves, new media insertion, upload cleanup and uncertain-save
  preservation). Fixtures do not write operational records or upload church files.


## KRV corpus repair display (2026-10-14)

Production KRV corrections were independently read back after guarded SQL:
Exodus 9:16, 1 Chronicles 21–22, Psalms 72 and 83, Song 6–8, and Jeremiah
32–33. Original rows remain in a private maintenance backup. Combined inclusion
markers are inactive records, so contained-verse lookup emits the full body once.

The dedicated scripture repair display helper renews only these ten KRV chapter
cache keys; old persistent values and unrelated chapters/translations are retained.
Long reading/citation/sermon bodies fit inside their scripture frame at the largest
fitting font size. Short bodies retain their existing typography. Fitting reruns
on frame changes, font readiness and resize. No scripture wording is embedded in
the display helper. PostgreSQL rollback/replay guards, 90 corpus-flow assertions,
cache/fitting fixtures and actual local reading-output verification passed.
The user explicitly approved publication of this display/cache update.

### 2026-10-14 Unlinked praise creation action

- Unlinked praise/special-song inputs show `새 곡 추가`, including empty strict DB-selection slots. Linked songs retain the existing DB-open button; scripture and non-song rows are unchanged.
- Empty slots ask for a title before creation; cancel/blank input writes nothing. Reuse existing exact-match song resolution and medley-title rejection. A newly created song receives the entered title; no sibling slots or medley links are normalized or rewritten by this UI change.


### 2026-10-14 Four praise loading modes

- User-approved picker order and labels: `가사 로드` (default, `lyrics_db`),
  `가사 직접 입력` (`manual_praise`), `찬송가: 악보 로드` (`score_db`),
  `어린이: 음원 로드` (`children_audio`). Existing manual-entry and hymn-score
  semantics remain; do not bulk-convert stored worship items.
- Children audio is restricted to versions whose effective praise types include
  `children`. It uses a saved set of designated lyrics/forms, audio bytes and
  automatic page cues. Ordinary lyric loading does not activate that set's audio
  timeline. The timing editor is available only for children versions, including
  while preparing a set in ordinary lyric mode. Service form editing is hidden
  in children-audio mode because the saved set owns its sequence.
- Extend existing local/shared timing bundles with source-version signature and
  the designated form sequence. Validate the source and rendered page fingerprint
  before automatic playback. A missing, disabled or stale set displays a warning
  and does not automatically advance. Older timing profiles remain stored; open
  and save them as a children set before using the new mode. No library import
  or automatic upload is part of this change.
- Sharing restores the package's form sequence even if the receiving worship
  item has a different form. Source lyrics/version mismatch rejects the package.
  Audio, timing and forms remain separate from song/worship/medley records.
- Persist exact modes in existing JSON config/content state; legacy typed DB
  columns continue using `praise_db`. When reading that compatibility value,
  restore the precise saved praise mode rather than losing it to `praise_db`.
- Local verification: Chromium/WebKit timing and independent-profile sharing
  suites cover mode switches, designated-form ownership, serialization/reopen,
  changed-form shared loads, decoded audio playback and stale-data guards.
  Content-identity regression preserves ordering through mode edits and saves.
  No production record or schema changes; deployment is separate.


## Setlist archive under Operations (2026-10-14)

- Move the archive entry from the worship/home sidebar into the Operations
  navigation alongside calendar, references and worship manuals (`setlists` route).
- Reuse the same archive records, filtering, song links and service links. Opening
  a service enters its worship screen; Back restores the archive search, view,
  month and scroll. Existing legacy archive links remain readable.
- This is navigation only: no record migration, backfill or worship writes.

- Direct archive service links open the presenter working surface without an
  intermediate service-route history entry. Late song-catalog completion also
  refreshes direct `setlists` links, independent of a legacy panel selection.


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


### Pending hymn titles and transition blanks (2026-10-14)

- Transition blanks clear inherited song-title/fullscreen metadata. The fullscreen
  title adapter also excludes blank-layout and automatic trailing-blank slides,
  including old restored snapshots. A pending score must not create two visible
  copies of its song title. No song or worship records are rewritten.
- Hover-only board refresh deferral is bounded to 600 ms. Active click interaction
  still retains the existing 150 ms protection; viewport/focus restoration remains
  in the existing patch path. Delayed hymn assets can replace the pending board
  without requiring a pointer move or page reload.


### Verified SAE punctuation cache renewal ·2026-10-14

Preserve previous repair scopes and COG GEN1 override. Bump only the independently
verified SAE scopes after764-row production confirmation; old persistent caches
remain recoverable. User authorized continuing original-edition repairs and
operational cache renewal. Local3181 assertions and bounded fitting pass.


### KJV confirmed damage cache renewal ·2026-10-14

Add six independently verified KJV chapters after exact full-row production
confirmation. Preserve SAE643 chapters and earlier repairs/COG GEN1 override.
No spelling modernization or worship records change. Backup and provenance stay
private; public release contains address scopes only.


### COG original full-verse cache renewal ·2026-10-14

After independent8103-row production confirmation, renew the COG regular chapter
repair scopes and retain previous original restoration scopes/GEN1 override.
Quarantined64 structural chapters are not implied completely proofread. Keep
old persistent entries recoverable. Public release carries addresses only.

## Scripture character justification · 2026-10-16

- User reverted word-only scripture wrapping because it made word gaps too wide.
- Reading, sermon and live/citation scripture use character-level wrapping and
  justification: `word-break: break-all`, `line-break: anywhere`,
  `overflow-wrap: anywhere`, `text-justify: inter-character`.
- Retain left-aligned last lines, explicit line breaks and bounded text fitting.
  Transformed previews retain the same layout font size as output.
- Verify Chromium/WebKit with `tests/smoke_scripture_character_wrap.py` and
  `tests/smoke_scripture_reading_scale.py`. Canonical text is unchanged.


## Announcement word boundaries and fitting · 2026-10-15

- All announcement copy keeps Korean eojeol and English words intact. Use
  `word-break: keep-all` and `overflow-wrap: normal`, including anchored zones.
- Lower-bar announcements share the existing complete-line lyric fitter and its
  typography-aware cache. Their authored line/chunk order, numbering, bold and
  smaller parenthetical text remain unchanged.
- Preserve the existing centered ordinary-list layout; do not introduce new
  announcement forms or dedicated insets. The shared region fitter checks child
  bounds and the existing heading as well as scroll size, detecting overflow
  above the box without relocating the list.
- Fit affects rendered font size only, never saved copy or pagination. Output
  and previews use the same fitting path. Validate Korean/English, long words,
  dense lists, both browser engines, and existing lyrics/aside behavior.

### 2026-10-15 compact live scripture and service summary

- Live scripture places `즉시 송출` beside its heading. Remove the redundant
  Enter icon button; Enter in the reference field still adds the passage, and
  IME composition remains guarded. Preserve checkbox state and input drafts.
- Left service summary uses a 35px pink icon-only output button beside the
  title, with accessible label/title for start or stop. Date status and date
  share a wrapping metadata row. Right output controls remain unchanged.

### 2026-10-15 navigation and source actions

- Remove the duplicate slide-number jump button; keep Enter, Escape and arrow
  navigation in the number input, plus previous/next buttons.
- Source Apply and Copy share two equal columns at all widths. Retain source
  history/recovery, input spacing and panel padding.

### 2026-10-15 media preview space

- Before attachment, use a plain helper line instead of an empty preview box.
- Connected images and their thumbnail strip stay inside the collapsed preview.
  Keep name/count and the preview toggle available; preserve editing gutters.
- Bible search keeps the result range/count above the list, removing only the
  repeated header count. Translation, paging and no-result states remain.

Validation: Chromium/WebKit media collapse/selection and search-count tests,
input polish, and bulletin print pass. `smoke_reference_batch.py` fails at
`save failure retained dummy` on both this change and the unmodified baseline
(d574445d app.js). This pre-existing batch-save test issue remains unresolved;
this UI change does not modify upload/save behavior.

### 2026-10-15 remaining audit failures resolved

- Setlist Back restoration: the saved offset was 500px, but Chromium scroll
  anchoring moved it to 338px while the animated shell rails reflowed the archive.
  Wait for body animations to settle before restoring the history viewport.
  The regression test now also checks the offset after animations and two frames,
  preventing an early, transient matching offset from passing.
- Video retry: the 26MB fixture was being serialized through Playwright routing;
  retry results were intermittent (including standalone passes without runtime
  changes). Serve the same video directly from a local HTTP server with real 503
  failure and 206 byte-range responses. Assert those responses as well as actual
  playback progress. Keep the existing timeout, single reload, healthy reuse,
  stale-frame guard, pause/resume and autoplay-blocked checks. Video runtime is
  unchanged; this removes the automation transport from the media data path.
- Both tests pass Chromium and WebKit. Updated audit totals: 190 passed,
  1 production-only check excluded, 0 unresolved. These totals combine the prior
  full audit with targeted follow-up runs, not a second complete suite run.
- External requests blocked during local checks; no production worship or Storage
  changes. Web release: `20261015-history-scroll-retry`.

## Edition-specific supplementary scripture ·2026-10-16

Scripture taxonomy now includes Deuterocanon/Apocrypha only when supplied by the
selected translation. COG uses separate GKE/DA1 additions; canonical Esther and
Daniel link to them. Literal chapter labels and sparse chapter options survive
reading, search, copy and service/presenter payloads. Global reference lookup
retains known book identities when the reader switches to another edition,
while the reader list filters by edition availability. Storage keys are never
shown as publisher labels. Selection and output follow source order.

Metadata is retained in Bible fetch/cache paths. The151 supplemental COG chapter
keys receive a scoped cache suffix; all prior canonical/repair scopes persist.
Existing services, source document identity, UUIDs and personal notes are not
rewritten. Publisher paratext stays separate from verse body. See the supplemental
Data/UX handoff contract and the full production readback receipt.


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


## Reading preview scale correction · 2026-10-16

Reading text fitting converts transformed viewport bounds back to layout pixels
before comparing scroll metrics. Thumbnail scale must not reduce the original
reading font. Output and preview retain the same fitting size, including long
verses and the final Fin. marker. Verified offline in Chromium and WebKit with
`tests/smoke_scripture_reading_scale.py` and scripture word-boundary checks.
No canonical text, service data, or cache renewal scope changes.

## Global music and output controls (2026-10-17)

The topbar retains current music status/title and play/pause/stop controls across
views. An active output similarly exposes its service, guarded return and stop.
Controls target their active owners, not the currently viewed service. Music and
output stop independently. See `friday-prayer-music.md` for the shared transport
contract and offline Chromium/WebKit verification scope.


## Service-local display modes · 2026-10-17

Linked DB song content compares score/lyrics modes as equivalent, so changing
only display mode does not issue sibling saves. A later song/version/form change
preserves each target's score/lyrics inputMode and outputMode. Existing serialized
retry signatures are normalized for comparison only. Manual lyric conversion,
explicit form-disable choices, local draft guards and all-generation exclusion
remain unchanged. First/second third-song sharing still supplies the ordinary
third-service hymn; it does not replace third-service praise.

Presenter secondary preparation/settings are folded under `편집·설정`. Core live
controls remain visible; the explicit blackout button reuses jump index -1.

## Output lower-bar backing (2026-10-17)

The real output stage now owns the same navy lower-bar backing as thumbnails.
A fractional child paint boundary must not expose the green stage beneath the
caption bar. Applies only to chromakey lyrics/song-title/scripture/title-assignee
slides; blank green and clean output retain their own background behavior.
`tests/smoke_output_bar_edge.py` checks stage backing and fractional viewport/DPR
edge pixels in Chromium/WebKit. The reported screenshot contains a mixed green
bottom pixel; exact compositor reproduction was not observed in the test fixture.

Release verification expands to all four output edges across eight viewport/DPR
combinations using renderPresenterOutput, four lower-bar layouts and blank
transition. Only active layers own backing; hidden previous frames cannot
recolor blank output. The inherent one-device-pixel antialiased outer boundary
of a fractional green stage is excluded from outside-letterbox checks.


## Transport popover and existing preparation editor · 2026-10-17

Supersedes the collapsed controller settings introduced earlier today. Global
output/music controls now open from a compact topbar launcher in a native popover;
state updates preserve the panel and playback. Stop actions are labelled
`송출 종료` and `음악 정지`. Screen selection and always-on-top share this panel.
Preparation fields move into the existing order editor, preserving service-scoped
drafts and Apply; the controller has an `예배 순서 편집` shortcut instead of
`편집·설정`. No extra preparation panel and no production data changes.

Local checks: Chromium/WebKit actual popover clicks, narrow/desktop layout, Esc
focus return, playback owner isolation, preparation draft rerender retention,
fixed-label preparation test, live-controller stability and Cloud baseline.
The two linked-song audit findings (song-clear display mode and empty third hymn
form protection) remain separate from this UI change.


## Linked-song clear and vacant-hymn protection · 2026-10-17

Score/lyrics mode equivalence also covers an empty DB-song selection. Clearing
a shared song preserves the target service's score/lyrics input and output mode;
a subsequent mode-only edit of that empty slot does not enqueue sibling writes.
Manual-lyrics conversion remains a content change.

When the existing empty third-service hymn receives song 3 from service 1/2,
fill song/version but preserve any existing form hint, preset, preset rules or
explicit formPresetDisabled choice as a unit. A slot without form configuration
receives the source form as before. Populated targets retain the previous-content
conflict guard; local drafts, live output, all-generation and custom media guards
are unchanged. No new write path or production repair is introduced.

Validation covers both score/lyrics directions, clear, blank-mode comparison,
custom/disabled/unconfigured hymn forms and atomic row read-back in offline
Chromium/WebKit. Existing sync scope/CAS/retry and Cloud baseline checks remain.


## Linked-song hydration and retry guards · 2026-10-17

A vacant third-service hymn is determined from persisted song/version IDs, title
and manual slides, never from whether its song catalogue is already loaded.
Existing independent content retains the normal signature conflict guard. Form
configuration alone still permits the existing vacant-hymn fill with local form
preservation.

Pending Sunday sync requires exactly one eligible saved source matching the
queued content signature. Deleted, ambiguous, replaced or changed source items
cancel the stale job and report incomplete linked propagation without writing
the target. A unique unchanged source retains normal retry behavior.

Offline Chromium/WebKit regressions exercise actual mocked atomic rows with an
unhydrated independent hymn and pending retries with zero, one and two source
matches. Production data and schema are unchanged.


## Explicit transport and context-editor controls · 2026-10-17

The transport launcher displays a monitor icon, 송출·음악 label and a reserved
activity dot so playing/stopping does not resize the header. The separate read-only
monitor uses only an activity icon, with 기기 상태 retained as its tooltip and
accessible name; it is not an output controller.
Right-click section editing labels 항목명, 담당, 내용 and 표시 형식 explicitly,
with visible input surfaces and responsive columns. Existing stored strings,
field bindings, playback ownership, keyboard focus and output are preserved.


## Worship view readiness · 2026-10-17

Before an opened service has its stored rows and linked songs, show a dedicated
예배를 준비하고 있어요 status in its content pane and a compact loading notice
in its outline. Projected template placeholders are not missing-input warnings
until readiness completes. No artificial minimum animation or global boot logo
is used; already loaded services reopen immediately.

Failures expose retry with aria-busy=false. Completion only replaces the selected
service's loading view; navigating elsewhere cannot be undone by an old request.
Local drafts and an existing live controller are protected from loading/error
replacement. Audio and output ownership remain unchanged. Asset/scripture
background warmup retains its own loading behavior and does not block this gate.
Offline Chromium/WebKit checks cover delayed rows/songs, genuine missing input
after completion, cached revisits, failure/retry, stale completion and live controls.

## Version picker label and chevron (2026-10-17)

Worship song version options display `버전: <original version name>`; stored
names and option IDs are unchanged. Keep the native select inside a layout
wrapper with a centered chevron inset 12px and 32px text padding so platform
arrows cannot hug the outer edge. Chromium/WebKit fixture checks verify label,
selection identity and chevron spacing. No worship data changes.


## Full-pane empty/loading alignment (2026-10-17)

Center the common loading skeleton only when it is a direct detail-pane child.
Embedded list skeletons retain their normal flow and padding. No-gathering and
deferred past-service notices use the shared centered empty-detail layout.
The deferred action uses the existing data-open-presenter-service handler in
both service and presenter contexts; sidebar-only data-service-id cannot open
a service from the detail pane. No production data, output or print changes.
Offline smoke_empty_state_layout.py covers Chromium/WebKit, four viewport sizes,
both themes, nested loading preservation and actual deferred button clicks.

## Seed direct-entry praise lyrics (2026-10-17)

Changing praise input to manual_praise copies the current presenter's selected
lyric version and effective form sequence (including repeated forms and children
synced form selection) into editable manual slide blocks before the existing
manual-mode unlink step. Existing nonempty manual blocks are not overwritten.
Source songs/versions and sibling/medley metadata are unchanged. No title or
blank slide is copied. Relational lyrics are loaded before switching when needed;
load failure keeps the old mode, and stale completion cannot overwrite newer
item edits. This does not retain a separate draft after switching back to DB mode.
Offline Chromium/WebKit regression: tests/smoke_manual_praise_seed.py.

## Praise editor layout and shared select arrows (2026-10-17)

Praise board inputs group mode/title/version/DB on the first row and form/assignee
on the second, wrapping to additional rows inside narrow containers. Header
labels keep their own row. Input mode uses the same inset chevron wrapper as
version; other editor selects use a matching inset indicator. Native keyboard
selection and data attributes remain unchanged. Board background-photo controls
are offered once with header actions, not duplicated inside the field row.

## Restore inline preparation inputs (2026-10-17)

User reverted the preparation-editor relocation. Keep live scripture below the
preview, then the always-visible preparation fields and Apply in the right rail.
Remove the duplicate preparation fields from the structural order dialog and the
replacement sidebar shortcut. Preserve per-service drafts, existing Apply and
atomic saves. Transport popover and structural editing remain available.

Validation: controller essentials and citation sidebar checks pass Chromium/WebKit
at desktop and narrow widths, including draft/caret/scroll retention and preview
placement. Fixed-label preparation and live-controller stability pass both engines.
Local Cloud baseline passes 7 unit + 5 smoke entry points; this is not Cloud
execution or deployment. Existing production worship records are untouched.


## Worship-specific recorded lyric/photo timing (2026-10-17)

- Non-children `lyrics_db` songs expose 음원 동기화 for their final rendered
  sequence, after form-background photos are composed. Key profiles by service,
  element, song and version; never inherit another service's timings. Children's
  designated-set behavior and one-second lyric lead remain unchanged.
- Record when singing begins: lyrics advance one second early, including lyric
  pages over photos. Instrumental/blank/photo-only pages use their recorded time.
  The editor shows photos and form labels, supports sequential or individual
  stamps, manual seconds, an existing linked audio download or a local file.
  Save uses the existing browser-local IndexedDB store. Optional immutable shared
  bundles use the existing explicit share/load flow for the same service/element.
  No schema, worship/song record or automatic public upload changes.
- Fingerprint the final visible text/page/form/photo order plus linked audio URL;
  replaced bytes reset stamps. Stale/disabled profiles cannot activate an older
  timeline. Excluded/hidden photos cannot be timed. A matching recorded photo
  timeline may cross its own photo boundaries; unrecorded media still stops the
  old lyric timeline as before. This supersedes the blanket manual-photo-only
  boundary for explicitly recorded service profiles only.
- 동기화 처음부터 재생 starts the controller's existing audio engine, never a
  second player. Existing active music and another service's live output block
  it. Manual navigation pauses synchronization; global music controls resume or
  stop. The same panel exposes audio-position seeking for timing profiles.
  Earlier manually chosen audio must not override an active presenter source.
- Offline Chromium/WebKit validation covers sequential recording, linked audio,
  lyric/photo playback, forward/backward UI seek, exact cue boundaries, paused
  clock, manual navigation, blackout/live-scripture guards, changed photo order
  and linked audio, cross-service isolation, reload, disable, and zero DB writes.
  The same fixture also decoded the actual linked Cadaros MP3 (264.216 seconds);
  its fixture timestamps are test data, NOT calibrated production cues.
  Existing timing/sharing, photo placement/output and global playback checks pass.


## Manual praise keeps song identity, not version (2026-10-17)

Supersedes the manual unlink rule above. Switching to manual entry or editing its
lyrics preserves the existing song_id and clears both version aliases. No backup
identity or lyric field is added. Manual output uses only the entered blocks.
Switching back to lyrics/score/children mode clears manual blocks, keeps song and
form/medley metadata, and leaves the version empty. The existing picker shows
“버전을 선택해 주세요”, including songs with one version. Empty-version drafts
can be saved and reopened without inferred version IDs or fallback output; an
explicit version selection resumes the corresponding output. Existing linked
items without a version also require selection instead of silently using defaults.
Old manual records whose song ID was already discarded cannot be recovered
automatically; the user must select their song once.


## Visible-first preview fitting and bounded board layout (2026-10-17)

- Queue only board thumbnail text fits. Read viewport geometry together, process
  visible thumbnails before the 200 px nearby band, and yield after an 8 ms
  budget (one fit is indivisible). Distant work sleeps until scroll or layout
  invalidation; detached previews are discarded. Font completion/error clears
  the fit cache and uses the same queue instead of refitting the entire board.
- Controller live preview and actual output retain synchronous fitting. The
  complete-line measurement, binary search, font metrics, verse gutter, cache
  keys and actual output render/commit path are unchanged.
- Give the five nested single-column board grids explicit minmax(0, 1fr)
  columns to avoid repeated intrinsic-width layout. Fixed 1920x1080 miniature
  canvases contain their layout/size/paint. Keep existing gaps and narrow-window
  layout. Static board thumbnails no longer force a translateZ/will-change 3D
  layer per full-HD canvas; live preview/output compositor rules are unchanged.
  This avoids unnecessary persistent compositor layers. It is NOT proof that
  the separately reproduced WebKit paint stall is eliminated: candidate testing
  passed, but the final public-URL stress run still exceeded 500 ms. No
  content-visibility gating or hidden placeholder is introduced.
- New 180-preview Chromium/WebKit regression uses the nested board structure:
  visible-first ordering, dormant offscreen queue, rapid scrolling, input timer
  gaps below 500 ms, exact original font sizes, no clipping, font invalidation
  and detached-node cleanup. Additional lyric/cache, announcement, preview edge,
  controller, output latency/swap and deferred-scroll checks pass. Local Cloud
  baseline passes 7 unit + 5 smoke entry points.
- Output-swap mock now releases subsequent requests for the same PNG after the
  delayed preload succeeds (Playwright routing disables HTTP cache). All existing
  delayed-frame, exact pixel, attached-layer and blackout assertions are retained
  and pass in Chromium/WebKit; no output runtime workaround was introduced.
- Read-only production measurement with candidate assets reduced one service's
  ready time from 15.2 s to 2.2 s in isolated Chromium. This is a measured sample,
  not a universal startup guarantee. No existing worship records, files or DB
  settings were changed; physical mixer output is not covered by browser tests.
  Installed Chrome repeated open/scroll checks passed three runs (2.1–3.8 s
  ready time, maximum long task 286–785 ms), with no service errors or horizontal
  overflow. Initial release a0a235fa passed Pages39009837792 and Linux Cloud
  checks39009837995; public JS/CSS hashes matched. Its installed Chrome repeated
  read-only open/scroll checks took 1.8–2.8 s (maximum long task 170–254 ms).
  The public-URL synthetic fixture disables DB configuration just like the local
  offline server and awaits its introduced presenter fonts before traversal.
  It retains the separate font-invalidation test and all 500 ms/clipping checks.
  Follow-up ee29a659 / 20261017-visible-preview-fit-2 passed Pages39010778225
  and Linux Cloud checks39010778547; all three public runtime file hashes match.
  Public 180-preview Chromium check passed (30.2 ms maximum timer gap, zero
  clipping/size differences). WebKit retained zero clipping/size differences but
  FAILED the unchanged 500 ms responsiveness assertion at 809 ms. Local WebKit
  passed (41 ms); a candidate remote run passed (213 ms), so neither is sufficient
  to close the remote WebKit performance issue. Instrumented remote runs measured
  at most 17 ms per fit / 16 ms per drain / 3 ms per scroll assignment while both
  timer and animation-frame gaps approached 1 s. Further render/compositor-level
  investigation remains; do not weaken the assertion or claim all browsers pass.

- A concurrent cold-font public output check initially measured invisible
  font-display:block fallback glyph bounds while document.fonts.status was
  loading (the captured output was blank). After font load, the actual face fit
  correctly. The lyric-bound fixture now awaits fonts introduced by each slide
  and two paint callbacks; all existing bounds, scale and gutter assertions stay
  unchanged. Slow-network and 4x CPU diagnostic runs also passed the original
  bounds checks. This does not promise instant text before fonts arrive.
- Final ee29a659 public installed-Chrome read-only service open/scroll checks:
  3127 / 1955 / 1776 ms ready times; 184 / 256 / 197 ms maximum long tasks;
  no service error or horizontal overflow. Public output checks pass 24 lyric
  bounds cases, cache/font invalidation and delayed image/background/blackout
  transitions in Chromium/WebKit. Existing production services remain untouched.


## WebKit background decode stall (2026-10-17)

Supersedes the unresolved background-paint investigation above. Native sampling
of an isolated Playwright WebContent process located the stall in background
painting, PNG decoding and ShareableBitmap transfers, outside the fit queue.
Built-in backgrounds are print-sized 3508×2480 PNGs. Async img decoding alone and
moving images outside the transformed stage did not reliably meet 500 ms; those
candidate changes were discarded, preserving the existing preview layout.

Only miniature previews now map the 17 exact same-origin built-in background
paths to derived WebP assets, bounded to 1280 pixels and lossless after Lanczos
resizing. `tools/build_preview_backgrounds.py` reproduces them; originals remain
untouched for output/print. Unknown names, uploaded/external/data/blob URLs and
the scripture-reading illustration retain their source. No slide text, stage
geometry, fitting rules, output readiness gate or persisted service changes.
This fixes the reproduced built-in background case, not arbitrary oversized
user uploads. Derived assets total approximately20MB versus140MB of originals.

The 180-thumbnail test retains the500ms assertion and now includes background
arrival/decode/two paint callbacks in its measurement window. Three cold candidate
public-URL runs passed: WebKit44/39/39ms; Chromium30.1/27.7/27ms, zero clipping or
font-size mismatches. Exact resized RGBA pixels of all17 assets, URL scope/query
preservation, six untouched-source cases, preview text bounds, and actual output
using the full-resolution original are independently tested. Local/deployed
regression and publication status are recorded below when complete.

Local regression passed: Cloud baseline7 unit +5 smoke entry points; exact asset
pixels; both-engine180-thumbnail and background/output-source checks; both-engine
24-case lyric bounds; cache invalidation; preview lifecycle/edge pixels; actual
output caption edges; output latency; delayed media/background/blackout swaps.
No assertions were lowered. Public deployment verification remains separate.


Release e40eb3e6 /20261017-preview-backgrounds: Pages39012291699 and Linux
Cloud39012292098 completed successfully. Public SHA256 matches all21 checked
runtime/release/derived-asset files. Three unmodified public stress runs passed:
WebKit39/43/43ms and Chromium28.6/42.6/32ms; all180 thumbnails fitted with zero
clipping/font-size differences. Both engines passed public17-asset/source-scope,
full-resolution output,24 lyric bounds cases, and delayed media/background/
blackout transitions. Local long announcement/lyric wrapping also passed.

Installed Chrome read-only service open/scroll checks:2435/1634/2067ms ready,
185/241/192ms maximum long task, no service error or horizontal overflow.
Requests capable of modifying production data were blocked. No service record,
lyrics, media upload, DB permissions or schema was changed. This verifies the
reproduced scenario; physical broadcast equipment and arbitrary uploaded images
remain outside this browser performance result.


## Verse number on split lyric forms (2026-10-17)

Lower-bar lyric verse numbers accept a single letter suffix on numbered Verse
markers (V1A/V1B, Verse 2 A). Display only the numeric verse in the existing gutter;
the segment letter remains a form identity and does not become a verse number.
Chorus/Pre-Chorus/Coda markers remain excluded. The first nonempty line receives
one number and matching inline numbering is still removed.


## Save completion preserves inline audio (2026-10-17)

Full worship save must not replace the detail pane while its native board or
attachment audio is playing. Persist and acknowledge normally, refresh the list
and save feedback, and retain the current audio node/time. Existing presenter
refresh still updates output. Paused/ended players retain ordinary full refresh.
This does not resume deliberately paused audio or start any new audio source.
Local Chromium/WebKit actual HTMLAudio playback checks exercise save completion
and paused-player refresh with stubbed persistence; no production writes.

## Save flushes pending order inputs (2026-10-17)

Explicit full-service save (Ctrl+S, Cmd+S, Save) commits all changed deferred
text fields belonging to the saved service, including blurred Enter-only
presenter inputs. Unchanged fields and other-service inputs are excluded;
active input is applied last if duplicated controls exist. Clear preview timers
before committing, and retain the existing atomic persistence path. This is not
an autosave or a change to Enter behavior. Chromium/WebKit shortcut tests cover
active/blurred drafts, Save-button focus and cross-service exclusion.

## Bounded home reads and startup overlap (2026-10-17)

Home aggregate reads run in groups of at most3 through the existing atomic read
client. Deduplicated input order is preserved; every group settles before an
error escapes, and no later group starts after failure. Adoption and metadata
publication still check loaded state/local drafts after awaiting. The write,
revision, durable retry and conflict paths are unchanged.

Bootstrap speculatively preloads scripts/styles using the HTML fallback version
while resolving the release, plus the atomic client/store modules. It executes
only the resolved version, in the original dependency order, after stylesheets
are ready. A stale fallback is download-only; timeout/retry/theme gates remain.
Controller font preloads include its existing four weights and start on entry/
direct presenter links; output retains its three-weight preload. Links deduplicate. Font faces, glyphs,
text fitting and output sizing are unchanged; rare-glyph full-font fallback is
retained. No assertion of reduced total font bytes is made.

The initial sidebar retains its rendered markup signature, so an identical
outline refresh neither replaces DOM nor reads scroll geometry. Service-row
loading now refreshes once after releasing its load lock, using the existing
presenter patch path on success and full error rendering on failure. It no
longer patches during loading and then unconditionally rebuilds the full view.

Validation: controlled concurrent-read settlement/draft/order/retry cases;
held release response proves concurrent downloads and resolved-only execution;
Chrome/WebKit boot recovery, loading/error/retry/stale completion, sidebar
identity/focus, layout batching, live-controller stability, conflict review,
24-case lyric bounds, output caption edges, delayed media/background/blackout,
and180-preview500ms budget pass. Cloud baseline7 unit +5 smoke entries passes.
Existing outline and reentry fixtures now explicitly supply their already-loaded
service/catalog state; both missing-state failures also reproduced before these
runtime changes. Layout-batch assertions were retained and exposed the actual
duplicate full-render path fixed above. Existing production services are not
modified; production browser probes block write requests. Deployment is separate.


Release404b48ff /20261017-startup-overlap preserves remote6861bb67 split-Verse
numbering. Integrated verse-number and24-case lyric bounds tests pass. Pages
39015696435 and Linux Cloud39015696573 completed successfully; public SHA256
matches boot/runtime/atomic-client/store/release files.

Public Chrome/WebKit tests pass actual app save functions against isolated fake
RPCs (full/element save, rollback, sibling/inflight drafts and linked-document
commit), lyric bounds, delayed image/background/blackout transitions and split
Verse numbers.180-thumbnail budget:33/41ms maximum timer gap, zero clipping or
font-size differences, unchanged500ms threshold.

Public read-only home/entry/reentry probes produced no service errors. Home
read requests visibly overlap in3/3/1 groups. Same-session alternating read-only
comparison of seven identical aggregates: sequential478/390ms versus bounded
parallel200/199ms, identical full responses. End-to-end home samples ranged
1.33–2.95s with variable network waits; these routed/profiler measurements do
not establish a uniform end-to-end speedup. Service board appearance was
0.24–0.51s and revisits0.12–0.22s; fonts/scripture warmup can finish later.
All production probes block writes. No existing services or DB settings changed.


## Save completion preserves inline audio (2026-10-17)

Full worship save must not replace the detail pane while its native board or
attachment audio is playing. Persist and acknowledge normally, refresh the list
and save feedback, and retain the current audio node/time. Existing presenter
refresh still updates output. Paused/ended players retain ordinary full refresh.
This does not resume deliberately paused audio or start any new audio source.
Local Chromium/WebKit actual HTMLAudio playback checks exercise save completion
and paused-player refresh with stubbed persistence; no production writes.

## Save flushes pending order inputs (2026-10-17)

Explicit full-service save (Ctrl+S, Cmd+S, Save) commits all changed deferred
text fields belonging to the saved service, including blurred Enter-only
presenter inputs. Unchanged fields and other-service inputs are excluded;
active input is applied last if duplicated controls exist. Clear preview timers
before committing, and retain the existing atomic persistence path. This is not
an autosave or a change to Enter behavior. Chromium/WebKit shortcut tests cover
active/blurred drafts, Save-button focus and cross-service exclusion.

## Direct lyric instrumental markers (2026-10-17)

A standalone [INT] line (case-insensitive) in direct praise lyrics creates an
instrumental blank slide, using the existing [간주]/[Interlude]/[Instrumental]
semantics. It separates neighboring lyrics even without empty lines, and also
works with explicit --- slide separators. Inline occurrences inside a lyric
line remain literal text. The marker is not printed in output; background and
manual navigation follow existing instrumental slides. No stored lyrics are
rewritten automatically.

## Manual lyric editor linked title (2026-10-17)

Direct lyric mode displays a retained linked song's title when raw_title is
empty; the strict DB-picker condition must not hide it. A user-entered raw title
has priority. Rendering does not write source data, change the linked version,
or seed/replace manual lyrics. Browser checks cover linked/manual/unlinked title
values alongside existing manual-mode roundtrip preservation.


## Audio management below praise inputs (2026-10-17)

Keep only audio registration in the item action row when no audio is attached.
Once audio exists, show its player, filename, replacement/disconnect actions and
eligible timing controls in a full-width audio manager below that item's inputs.
No standalone per-song timing buttons are rendered. Existing local/shared-loaded
children timing profiles also expose their audio in this manager; their timing
editor remains accessible. Each medley row filters timing controls by element ID.
Storage, timing keys, save paths, song links and ordering are unchanged.

## Compact board song inputs and heading DB links (2026-10-17)

At desktop widths, input mode, song title, version and song form share one row;
form no longer reserves a second row. Narrow containers retain wrapping. For
single-element board headers, the DB shortcut immediately follows the element
heading, outside the jump button; labelled multi-element rows follow the same
rule. Do not duplicate it inside the input controls. Headerless medley rows keep
their per-song DB links. Isolated Chromium/WebKit rendering checks cover desktop
alignment, a single actionable heading link, and narrow-width overflow.
## Lazy initial service projection and scripture catalog overlap (2026-10-17)

Initial worship loading retains the whole service list, but no longer materializes
every archived service's template before and after the initial aggregate reads.
Only requested/returned service groups are projected eagerly. Unopened services
use the existing getServiceItems projection on access, and remain DB-unloaded
until their aggregate is read. Saved rows, suppression markers and existing
atomic writes are unchanged. Grouped row keys are always retained even when
absent from the requested ID list; service lookup uses one local Map.

Template version metadata now selects the same last applicable version without
building/cloning all of its steps. Date, service-specific matcher and fallback
selection still use the existing version resolver. Scripture warmup and direct
verse lookup overlap
independent book and translation catalog reads, then awaits both before parsing
references; existing shared-load, cache, translation and error gates remain.
No font faces, fitting rules, output layout or persisted content changed.

Offline Chromium/WebKit checks compare lazy/eager template results with stable
fixture IDs, version selection across service types/dates, saved grouped rows
and archive loaded-state. With200 archived services plus1 current service and
rendering isolated, initial load projects only the1 current service instead of
all201 twice. Controlled catalog promises verify overlap, readiness and failure.
Cloud baseline7 unit +5 smoke entries passes, including actual app atomic-save
functions against fake RPCs. Home navigation, service load/retry, cached revisit,
loading reentry, presenter patching and180-thumbnail budget also pass. Final
output and deployment results are recorded separately below.

Both-engine24-case lyric bounds, output caption edges and delayed media/blackout
transitions pass with unchanged assertions. The new projection/catalog guards
join the default Cloud gate (now8 unit +6 smoke entry points).

Integrated upstream audio-manager and pending-input/playback save changes remain
intact. Their actual browser tests, manual praise/interlude tests, both-engine
lyric bounds and preview budget pass. Existing production records are read-only.


Performance commit65c45f78 passed Linux Cloud39016994840. Its Pages run was
superseded by downstream cd0bd081 (presence reporting), which includes all of
these changes; Pages39017082202 and Linux Cloud39017082239 succeeded. Public
index/release/app/presenter/monitor/song-timing/styles SHA256 values match that
integrated checkout (release20261017-presence-60-180). No migration was executed
by this performance task.

Public Chromium/WebKit projection/version equivalence and actual app full/element
save functions against isolated fake RPCs pass, including rollback, sibling and
inflight draft isolation, and linked-document atomic commit. Actual output passes
24 lyric-bound cases and delayed media/background/blackout transitions in both
engines.180-thumbnail maximum timer gaps30.4/41ms, zero clipping and font-size
mismatches; original500ms assertion unchanged.

Final installed-Chrome/WebKit read-only probes (two runs each): home1035–3070ms,
service board appearance204–253ms, revisit137–161ms, no service errors. Book and
translation catalog requests start within0–1ms of one another when both uncached.
Board appearance is not completion of all font/scripture/media loading. Network
variance prevents claiming a uniform end-to-end home speedup; the archive
projection reduction and independent request overlap are directly verified.
All production probes block writes, including presence registration. Existing
worship content, lyrics, media and DB settings remain unchanged by this task.

## Empty song form retains playback inference (2026-10-17)

Clearing the form input disables stored/template/song defaults but retains the
normal V1-C-V2-C playback inference for hymn/CCM lyrics. Existing cleared items
with formPresetDisabled receive the same read-time behavior, without DB writes.
The form input remains empty; linking/saving must not materialize this inference.
Explicit sequences, direct lyric blocks, children audio sets and score selection
retain their existing rules. A source without verse/chorus stays in source order.

## Explicit form order across lyrics and scores (2026-10-17)

Song/version metadata with song-default strength is an authored sequence: preserve
its order, repetitions and omissions; do not expand it as a generic V/C suggestion.
Automatic playback inference remains for empty forms, including cleared inputs.
Legacy formHint/form_hint/forms-only memo strings normalize into a real sequence
on read without rewriting stored records. Explicit preset arrays take precedence.
Score sequence lookup may revisit an earlier, not-yet-selected labelled group;
keep all continuation pages with that group and retain normal repeated-group
selection. Unknown requested labels do not select unrelated pages. No DB writes.

## UI font downloads and release priority (2026-10-17)

The UI's512492-byte Common font is partitioned into20 content-addressed WOFF2
segments. Latin, punctuation and symbols stay together for kerning; Hangul
syllables use disjoint128-character groups. The exact2925-codepoint coverage,
variable45–930 weight axis, glyph outlines and advances are retained. The
unmodified full Pretendard font remains available for uncommon characters.
The original Common file stays as reproducible source/evidence, not a runtime
preload. Presenter/output Freesentation fonts and fitting geometry are unchanged.

The base segment also supplies the MINDEX wordmark preload. CSS unicode-range
selects only needed segments; filenames contain their SHA256 prefix, so unchanged
fonts can reuse HTTP cache across app releases and changed bytes get a new URL.
The generator pins group membership in ui-segments.json and disables timestamp
rewrites. fontTools4.60.2/Brotli1.2.0 reproduce the assets. No operational data
cache or service-worker cache is introduced; aggregate reads/writes stay intact.

Release discovery still uses timestamped cache:no-store and the existing bounded
fallback/retry behavior. It starts at high priority before speculative script
downloads, which still cannot execute before the resolved release/styles. A
non-output page preconnects to its configured Supabase origin during downloads.

Verification:11700 source/segment glyph comparisons (all characters at45/400/
700/930), disjoint complete coverage and hashes. Both engines pass30 actual
wrapping/metric cases, full-font rare-character fallback, cached font reuse
across two freshly resolved releases, and resolved-only script execution. The
new real-HTTP-cache test joins the default Cloud gate (9 unit +7 smoke entries
after integration of the concurrent unchanged-save guard).

Read-only candidate home visits fetched304096 bytes of UI fonts versus512492
previously (40.7% less); subsequent service entry added33016 bytes. Actual use
varies by visible text. All segments together total632912 bytes, so a screen
requiring the whole common character set can download more than the old monolith.
Network/DB variability remains significant; byte reduction is not a universal
end-to-end startup timing guarantee. Production writes remain blocked in probes.
Deployment and final output/save results are recorded separately below.


## 2026-10-17 — Blackout preview matches actual output

The live preview reuses presenterSafetyBlankSlide() for number zero. Its previous
ordinary blank identity could retain the worship background and decorative cross
while actual output was black. Both surfaces now use the same blackout frame;
ordinary in-sequence blank slides keep their existing styling.

Chromium/WebKit regression covers two services and real output-window transport:
browsing another service preserves current output, navigation from an inactive
service cannot hijack output, explicit start switches to that service at index 0,
and number zero/one blackens/restores both live preview and output. No worship
records or service-switch semantics are changed.
Release861e07c8 /20261017-ui-font-segments includes upstream773f1feb explicit
forms andc35663ab unchanged-save guards. Integrated Cloud baseline9 unit +7
smoke entries, explicit-form tests and both-engine lyric bounds pass. Pages
39022426835 and Linux Cloud39022426589 succeeded. Public SHA256 matches all26
checked runtime/release/font files; regeneration reproduces the committed files.

Public Chrome/WebKit pass30 original/segmented width, kerning and wrapping cases
each, including rare-character fallback. Fully settled initial UI font downloads
are approximately304KB. Actual app full/element/linked saves pass against fake
RPCs, including rollback and draft isolation. Both engines pass24 lyric bounds
cases and delayed image/background/blackout transitions. One initial public
WebKit save-test attempt timed out before the app function became available;
the identical test passed on retry without relaxing its30-second timeout. This
transient boot failure is retained as evidence, not reclassified as a save failure
or proof of universally reliable startup under arbitrary network delay.

A separate production read-only probe preserves real browser HTTP caching (no
Playwright routing): fresh-session home2972ms Chrome/3718ms WebKit; two reloads
2221/2872ms Chrome and988/1553ms WebKit. Reloaded UI fonts transfer0 bytes.
Release checks and service reads still occur; no service read/write cache was
introduced. App JS alone took1440/2198ms on those cold samples, followed by
service-list/aggregate requests. Network variation prevents a controlled overall
speedup claim or a3-second ceiling. Production writes were blocked throughout;
no existing worship, lyric, media, DB schema or permission was changed.

Public180-thumbnail checks also pass: maximum timer gaps34.1ms Chrome/41ms
WebKit, zero clipping or font-size mismatches, unchanged500ms response limit.


## 2026-10-17 — Continuous bounded startup reads

Home aggregate loading now fills each free worker immediately, up to three
concurrent reads, instead of waiting for an entire three-read batch. It retains
fresh atomic reads, input-order results, deduplication and both adoption/draft
guards. A failure stops scheduling new work and settles all started reads before
releasing the caller; incomplete aggregate metadata is not published. No service
cache, database schema, save path or production record is changed.

The largest critical script (app.js) is the first speculative script queued,
after the fresh release request. Script execution still follows dependency order
and the stylesheet gate; fresh release resolution, retry and failure recovery
remain intact. This changes download priority, not transferred source size.

Local verification: default10 Node +7 browser entry points; deterministic slow
response model300ms versus prior360ms batch barrier, concurrency<=3, late drafts,
out-of-order results, failure settlement/retry; Chrome/WebKit fresh-release-only
execution and startup recovery;180-thumbnail fitting (zero clipping/mismatch),
24 lyric-bound cases each, delayed media/background/blackout transitions and
actual output-window ownership/switch/zero restoration. Network latency remains
variable; the synthetic scheduling gain is not a whole-app speedup guarantee.
Deployment and production verification are recorded separately.

## Direct-entry worship audio timing (2026-10-17)

`manual_praise` uses the same occurrence-scoped audio timing editor and playback
as linked lyrics. A song or version selection is not required. Its key includes
the service, element and explicit manual-mode discriminator, so it never loads
a linked-version timing profile. Final rendered lyrics, instrumental pages,
photo order and linked audio URL still invalidate stale profiles. Direct lyrics
and worship/song records are preserved; local save and explicit sharing retain
their existing storage paths. Lyrics advance one second before their recorded
onset; instrumental pages use their recorded time unchanged.

Offline Chromium/WebKit checks cover editor save, fresh-page reload, actual audio
playback/seek, cue boundaries, altered lyrics/audio, service isolation and no DB
writes. Existing lyric/photo and shared timing checks plus the Cloud baseline
pass locally. This does not certify any real song's calibration or deployment.

## Playback toolbar placement and anchored panel (2026-10-17)

The output/music launcher belongs beside theme/refresh/save in the toolbar, not
among page tabs. Match the40px toolbar hit area and remove idle indicator space.
The native popover opens8px below the launcher, left aligned when space permits,
clamped inside the viewport, at320px maximum width with16px content padding.
Resize clamping is CSS-based so it works before the resize event runs. Keep open
panels anchored after state patches; retain native Escape/outside dismissal,
focus return and playback ownership. Toolbar button styling targets direct children
so panel controls do not inherit fixed toolbar widths. Browser checks cover desktop
760–1440px, both themes, viewport clamping, updates and existing playback actions.


Read-pool release receipt:32a9196a passed Pages39023635774 and Linux Cloud
39023636044. Public index/app/release bytes matched that commit. Both engines
passed public actual-app fake-RPC full/element/linked saves, rollback/draft
isolation,24 lyric-bounds cases and delayed media/background/blackout swaps.
Production writes were blocked; no existing worship data was changed.

Retained limitation: initial public save/output attempts timed out during boot;
several static files (including small modules/fonts) simultaneously took about
26 seconds. Identical limits/assertions subsequently passed, without a runtime
change or increased timeout. This is not proof the initial startup failure is
fixed. Native-cache samples were Chrome29084/3351/1295ms and WebKit18584/7439/
5013ms; every navigation still performed7 fresh aggregate reads, and repeat app
transfers were cached. After other browser tests ended, fresh sessions measured
4792ms Chrome/2725ms WebKit on the subsequent upstream manual-song-timing
release (which contains this change). These are separate network samples, not
controlled evidence of an overall speedup. Static delivery/DB latency remains
variable; no universal3-second bound or completed download-size reduction is
claimed. Concurrent upstream timing and toolbar changes were preserved.

## 2026-10-17 — Startup network recovery and read visibility

Production probes showed variable cold static downloads (app.js roughly8–20s),
and one pre-runtime startup failure while the stylesheet gate was pending.
Playwright routing disables normal HTTP caching, so routed capture probes are
not representative of warm user reloads. Gzip is already enabled (app.js about
330KB transferred); this change does not claim a server outage or fixed latency.

Queue the stylesheet preloads before scripts and request them at high priority;
app.js remains first among scripts, execution order and release freshness remain
unchanged. A script/stylesheet network error retries once with a fresh URL.
Timeouts and runtime exceptions do not replay scripts; permanent failure retains
the bounded error/reload UI. Once authentication and module loading setup are
ready, show the shell while initial reads settle through their existing loading/
error states. Auth is still awaited; no reads, saves or permissions are skipped.

Chromium/WebKit tests cover one-off CSS/script failure, exactly one app execution,
slow initial data, permanent failures, stalled resources, manual recovery,
stylesheet-before-script requests and resolved-only execution.


## DB shortcuts · 2026-10-17

Element-heading and inline DB shortcuts use transparent text with no horizontal
padding. Hover underlines actionable links; native keyboard focus remains visible.
Manual/non-actionable labels do not acquire a hover underline.

## Cadaros caption bar height · 2026-10-17

The Cadaros white/gold song-title and lyric bar uses20% of the stage height
(previously21%). The standard title/assignee navy bar remains18%. Ornament,
font, horizontal padding and text offset are unchanged. Chromium/WebKit actual
output checks at1920×1080,1366×768,960×540,900×900,406×228 and320×180 retain
the crest and two-line Korean lyrics entirely within the bar without overlap.
No service content or song/medley data is changed.


## 2026-10-17 — Saved timing playback after section titles

A manual praise group may begin with a person/title slide without a timing cue.
Determine whether to show the restart button from the whole element group, not
only that first slide. Keep one editor/restart pair per element. Chromium/WebKit
regression covers an untimed title preceding a locally timed lyric.


## Compact editor links · 2026-10-17

Related-song links, linked-version headings and section-add controls use plain
text with hover underlines; selected version surfaces and warnings remain.
Collapsed direct lyrics hide their textarea without removing its draft value.
Expanded lyrics occupy a full following row. Output and print CSS are untouched.


## 2026-10-17 — Recover silently stalled downloads before execution

The remaining reproduced startup failure is a request that neither completes
nor emits a network error. Error-only retry cannot recover it. Static delivery
latency itself was variable across unrelated files; no specific CDN/server fault
is proven. Preloads now track completion and script insertion waits for a ready
URL. Only an asset actively blocking startup gets one alternate URL after4s
(or immediately after a network error). First successful download wins; losing
preloads never execute scripts or apply styles. An unused stale-HTML speculative
version never retries. All consumed assets still share their original15-second
budget across download and application/execution, including error recovery.

CSS placeholders preserve cascade order even when downloads complete out of
order. Release freshness, original dependency execution order, CSS readiness and the
existing manual failure/retry UI remain. Timed-out/already executed scripts are
never replayed. The change does not cache worship data or alter saves/output,
and does not reduce app.js source size. A stalled request may transfer extra
bytes when its alternate is needed; ordinary successful downloads do not retry.
An outage affecting both requests can still reach the bounded error UI.

Chrome/WebKit fixtures hold app/constants/vendor/CSS downloads indefinitely, recover
through the current release, then deliver the original late: no second execution
or late style application. The opposite original-wins race is also covered.
Existing permanent failure,15-second stall, runtime failure, manual recovery,
version resolution, stylesheet gate, dependency and real font-cache tests remain.
The default Cloud gate now10 Node +8 browser entry points includes this regression.
Deployment and production measurements remain separate receipts.

## Direct lyric content height · 2026-10-17

Both order-editor and expanded board direct lyrics start at two lines, grow with
wrapped content and scroll above 55vh. Collapsed board text remains hidden.
The legacy scripture-record text editor is not the ordinary book/chapter reader;
its selection can be restored by scriptureId/session state, but the current sidebar
renders book-code buttons rather than scripture-record buttons. It is unchanged.


Stalled-download release receipt:0c02f90d passed Pages39025985767 and Linux
Cloud39025986389. Public index/release/app/main and output CSS exactly matched
local bytes. Both engines passed public actual-app fake-RPC full/element/linked
saves, rollback/draft isolation,24 lyric bounds and delayed media/background/
blackout swaps. Existing services were read only; writes including monitor
registration were blocked. No production records or permission changes occurred.

Retained local finding: one real-HTTP-cache run reported a release mismatch
without timing diagnostics. Diagnostics were added without relaxing assertions;
the isolated test, complete final10+8 gate and Linux gate passed. The individual
failure's cause was not established. Permanent errors/timeouts remain tested;
this change does not claim that arbitrary network outages always recover.

Native-cache production sample on0c02f90d: Chrome shell3311ms, current home data
4365ms; app download2686ms (HTTP/2,461ms first-byte wait,2225ms body transfer).
One service entry took12425ms with no per-request trace; its precise cause is
not proven. A subsequent read-only sample on upstreamb27f306a (containing this
change) measured fresh home shell/data1470/2050ms Chrome and3579/4245ms WebKit,
service entry1695/828ms. Slow service resources in that trace were presenter
fonts and the hymn manifest, not evidence establishing the earlier12s cause.
First home samples each read7 fresh aggregates. Post-service reloads used a
different restored/deferred-service workload and are not compared as home gains.
No startup timeout occurred in these deployed samples; network variation still
precludes a universal timing guarantee or controlled speedup claim.

Upstream9bb20f43 icon subset was preserved; Pages39026352247 and Linux Cloud
39026352491 succeeded. Public index/release/icon bytes matched and180-thumbnail
checks passed in both engines (zero clipping/mismatch; maximum gaps31.6/41ms).
The default gate is now11 Node +8 browser entries. Recovery coverage retains
both the new icon module and an unversioned vendor script (Supabase), plus CSS,
app/constants and both request-winner races. Local integrated recovery passed.


## 2026-10-17 — 예배에 저장하는 음원·가사 양식 (기존 로컬 기본 방식 대체)

사용자 요청에 따라 새 입력 선택지 ‘음원·가사’(audio_praise)는 어린이 음원 기능을
예배 소유 양식으로 확장한다. 음원이 기준이고 직접 입력 가사 화면과 cue를 같은
예배 항목에 보관한다. 찬양 DB의 곡·버전을 생성하거나 수정하지 않는다. 이전
children_audio는 기존 자료 열기 용도로만 유지하며 새 선택지는 연령을 제한하지 않는다.

음원 관리자를 가사보다 먼저 표시한다. 가사 입력은 직접 입력과 동일한 화면 분할을
사용하며, 예배 음원·타이밍 편집기의 ‘예배에 저장’은 기존 atomic 항목 저장 경로로
음원 주소·가사·타이밍을 함께 저장한다. 새 기기에서도 예배 조회만으로 타이밍을
복원한다. 예배용 편집기에 별도의 로컬/공유 저장·불러오기 절차는 없다.

기존 로컬 cue는 이관을 위해 읽을 수 있다. 저장된 예배 cue가 있으면 이를 우선하며,
가사·사진 순서·음원 연결이 달라지면 자동 전환을 무효화한다. 가사 1초 선행,
간주/사진 전용 정시 규칙을 유지한다. 수동 이동은 아래 최신 결정에 따라
음원을 유지하고 자동 싱킹만 해제한다. 기존 원본/로컬 자료는
성공적인 예배 저장이 확인되기 전에 삭제하지 않는다.

검증: 실제 atomic 저장 경로의 실패/재시도, 찬양 DB 쓰기 금지, 원문/DB 왕복,
독립 Chromium/WebKit 저장소에서 공유 불러오기 없이 실제 음원 재생 및 cue 복원.

## 2026-10-17 — Overlapping stalled-download recovery

All selected-release scripts now arm their existing bounded download/retry
clocks together, before the CSS gate. Previously each clock began only when
ordered execution reached that file: simultaneous CSS, icon and app stalls
therefore accumulated separate four-second retry waits. Download recovery can
overlap; CSS application and script execution retain their original order.
Unused speculative release assets still do not retry, and late preload responses
cannot execute or apply. No new origin, cached source execution or DB write path
is introduced. Each selected asset retains its 15-second total deadline.

The three-stall regression fails against the previous loader (not ready within
8 seconds) and passes Chromium/WebKit with a single retry interval. It also
checks current-release-only retries and no late second execution/application.
The default Cloud gate includes this case.

Transport investigation on the current Mac separately reproduced variable body
receipt without executing the app: static fetch batches ranged from under one
second to 5.8 seconds. CDN responses reported cache HIT; changing HTTP version,
preload/fetch, or concurrency did not establish a consistent causal fix. This
identifies an application-level delay multiplier, NOT a proven CDN/ISP fault or
a guarantee against network outages. No comparison on another network exists.


## Song search guidance · 2026-10-17

Empty song search guidance lives in the title placeholder (new-hymnal wording
where required). Keep a hidden picker target so deferred typing previews still
replace it. Remove the absolute negative-top hint style in all shared editors.
Loading and warning messages remain in flow and wrap in narrow controls.

## 금요예배 매뉴얼 안내 · 2026-10-17

- 예배 매뉴얼의 상위 표기 `금요예배(기획예배)`와 금요예배 분류는 그대로 유지한다.
- 넷째 주 안내는 `금요기도회 또는 구역연합예배`로 바꿔 금요기도회를 먼저 안내한다.
- 이번 변경은 매뉴얼 문구에 한한다. 저장된 예배와 자동 생성 규칙은 변경하지 않는다.

## Entry latency and background rendering · 2026-10-17

Native fresh-profile read-only measurements separated shell, current home data,
board insertion and font/visible-fit readiness. WebKit fetched the 2 MB full UI
font for a common-character service despite segmented fonts; its full face had
an overlapping unrestricted unicode range. The fallback now covers exactly
source cmap minus common glyphs. Full originals and all supported glyphs remain;
unsupported characters go directly to the existing system fallback. The old
rare-character test used a Han character absent from the source font; it now
checks both that unsupported character (no wasted request) and supported rare
Hangul (full fallback requested). Common glyphs/metrics are unchanged.

`loadWorshipData` retains the early list/loading render; its caller performs the
single final render after restoration, error/dirty flag cleanup and fingerprints.
It no longer builds the complete home cards immediately before that final render.
Background scripture-book lookup updates data/UI persistence but only rebuilds
the Scripture module. Service reference callers keep their existing resolved-slide
refresh paths; a lookup must not replace the worship editor DOM or its input draft.
No query caching, stored content, save algorithm or output sizing rule changes.


## 2026-10-17 — 긴 음원 타이밍 원문의 재저장

현재 예배 원문은 8000자 이력 미리보기 제한으로 자르지 않는다. 19장 음원
타이밍 fingerprint가 포함된 원문은 이 제한을 넘어 JSON 중간이 잘릴 수 있었고,
다음 저장의 기존 문서 비교 단계에서 실패했다. 현재 원문은 완전하게 보존하며
이력 요약의 기존 제한은 유지한다. 과거 잘린 문서를 비교할 때에만 마지막
미완성 타이밍 필드와 명시적 [truncated] 표시를 허용하고, canonical 예배 항목으로
완전한 문서를 재생성한다. 사용자 입력의 잘못된 JSON은 계속 거부한다.

가사 진입 검증은 플레이어 시각 검증과 별도다. 리허설↔MR의 반주 정렬 후
타격음과 발성 잔차를 대조하고, 반복 프레이즈의 같은 위치를 확인한다. 자동
음성인식은 합창·긴 음에서 시작 시각을 잘못 만들 수 있으므로 단독 기준으로
사용하지 않는다. 반주 제거 잔차도 분리 추정치이며 독립 청감 확인을 대신하지 않는다.

## Visible startup activity · 2026-10-17

The inline boot screen retains its cross/wordmark and adds a small spinner,
plain-language stage and elapsed seconds before any external asset is ready.
After four seconds it explains that startup is taking longer; actual retry
launches show retry status. Selected-release downloads, app execution and auth
initialization own their respective stage messages. No invented percentage or
claim of network progress is displayed. Existing bounded failure/retry UI stays.

The elapsed timer stops on completion/failure. Reduced motion disables spinning
while keeping readable status/time. Presenter output still hides all boot UI.
finishUiBoot awaits only finite reveal animations so an infinite activity spinner
cannot trap the app behind the logo. Chromium/WebKit tests cover stalled files,
retry text, reduced motion, successful transition, timer cleanup and output hiding.

## Editor pane overflow · 2026-10-17

Actual reference editing, praise/scripture metadata, preparation, section and
template screens are checked with long values at 640/760/900/1440px viewports.
Preparation rows previously kept desktop column minimums at narrow pane widths,
pushing action buttons outside the editor. Use a named 800px pane container
query for compact rows and authoring panels; keep the desktop shell unchanged.
Empty row placeholders no longer reserve implicit rows in that compact layout.
Chromium/WebKit tests assert control bounds and pairwise non-overlap in both
themes. Output/print styles and operational data are outside this change.

The older individual-input fixture assumed two rows despite current three-row
song/assignee/action markup; reproduced on unchanged HEAD styles. It now retains
all bounds/overlap assertions with a three-row ceiling and explicit assignee/action
separation. Runtime is regenerated by the pinned build tool; runtime bytes remain
unchanged for this CSS-only release.

Cache smoke fixtures now reuse MindexSmokeServer (128-request backlog) instead
of the default five-request queue. Browser requestfailed evidence reproduced
local connection resets during concurrent asset loading; assertions are unchanged.

## 주간 예배 상태 문구 정렬 · 2026-10-17

- 주간 날짜 카드의 `다가오는 예배`, `오늘 예배`, `지난 예배`는 카드 가운데 정렬한다. 날짜 머리글과 예배명 정렬은 유지한다.


## 찬양 입력 공간 정리 · 2026-10-17

- 넓은 입력 영역에서는 유형·곡명·버전·송폼·담당을 한 줄에 배치한다. 연결 전에는 빈 버전 열을 예약하지 않는다. 좁은 화면은 줄바꿈을 유지한다.
- 담당과 말씀의 바깥 라벨은 입력창 안내로 옮기고 접근성 이름은 유지한다. 말씀 예시는 `말씀 (예: 렘 3:22; 마 3:11)` 형식으로 표시한다.
Startup feedback proportions ·2026-10-17: keep the cross at45×55 and wordmark22px with5px tracking. Secondary feedback uses12px/20px text, a14px border-box spinner and5px gaps in a160px centered column. Short stages and a reserved40px detail area prevent retries/elapsed updates from shifting the logo. Feedback is muted to65%; brand spacing remains20px with10px extra separation before feedback.


Unified loading feedback ·2026-10-17 supersedes the compact startup sizing above.
Startup, sidebar, detail and service-data loading share one inline-defined row:
14px/20px regular text,16px border-box spinner,10px gap,1s rotation and reduced-motion support.
Remove decorative gray skeleton rows/lines; retain busy/status semantics and error retry controls.
Startup has no elapsed counter; a single4s timeout shows delay guidance, cancelled on completion/failure.
The logo stays22px; feedback is subordinate without making in-app status illegibly small.


## List full-name hints · 2026-10-17

Praise list/search titles, linked praise titles, reference card titles and background
original filenames retain compact ellipsis layout and expose the full escaped
display name through native title hints. No click, storage or output changes.
Offline Chromium/WebKit checks hover actual rendered long quoted names and verify
title values; native browser tooltip pixels are outside DOM screenshots.


## Presenter entry layout and timing correction · 2026-10-17

Patch the outline (including its scroll/focus reads) before inserting the large
new presenter board. Mounting deferred sections registers IntersectionObserver
without synchronously measuring every placeholder. The first two groups and
active group remain real DOM; the observer preloads within720px. Fast scroll
retains synchronous visible-placeholder hydration, and direct slide/item jumps
retain their existing explicit hydration. No data/read cache or font-fit change.

Native reentry measurements must call goHome() and assert state.module is home
before reopening. switchModule("home") is not a supported route, so earlier
“reentry” samples actually re-rendered the same presenter. They must not be used
as evidence of a home-reentry regression. Fresh data, first visible board, full
font readiness and same-view redraw remain distinct measurements.
## 전역 화면 색상 역할 통일 · 2026-10-17

- 본문·패널·입력창의 세 가지 불투명 배경을 전역 공통 토큰으로 통일한다. 중첩 패널은 새 명도 대신 여백과 선으로 구분한다.
- 선택·주요 동작은 강조색, 미입력·검토는 경고색, 실패·삭제는 위험색, 실제 송출·성공은 성공색을 사용한다. 일반 제목·분류·다가오는 예배·대기 상태는 중립색이다.
- 송출 CSS와 슬라이드의 기존 색상 상속은 보존한다. 실제 예배 데이터는 변경하지 않는다.


## Secondary full-text hints · 2026-10-17

List/search metadata, order song-picker title and metadata, linked version titles,
reference URLs and Bible book English names now expose escaped full text with
native title hints. Reference hints retain the original URL, including scheme
and query; visible short URLs remain unchanged. Layout, click actions, output,
print and operational data remain unchanged. Offline Chromium/WebKit hover and
long quoted-text checks cover the actual renderers.

## 2026-10-17 — 어린이 DB 음원과 예배 음원의 소유권 분리

앞의 ‘기존 children_audio는 열기 용도만 유지’ 결정은 사용자 정정으로 폐기한다.
`어린이: 음원 로드`는 새 항목에도 계속 제공한다. 어린이 곡·버전은 DB에
음원 주소·지정 폼·가사 fingerprint·타이밍 세트를 소유하고 여러 예배에서 사용한다.
`음원·가사`는 해당 예배 항목 소유이며 찬양 DB를 쓰지 않는다. 양쪽은 cue 검증과
재생 엔진만 공유한다. 음원 파일은 Storage, 연결과 타이밍은 기존 곡 memo의
`childrenAudioSets[versionId]`에 저장하므로 스키마 변경은 없다. 새 저장은 곡 DB가
우선이고 기존 로컬/공유 파일은 이관 호환용이다. 일반 가사 로드는 자동 넘김을
활성화하지 않는다. 가사/폼 변경은 기존 세트를 무효화한다.

‘자동 넘김 재생’은 해당 예배가 송출 중일 때 표시하며 실행 함수도 같은 조건을
확인한다. 송출 종료/연결 종료 시 동기화 음원은 멈추며 일반 배경음 재생은 보존한다.
준비 중에는 음원 미리 듣기와 타이밍 편집을 제공한다. 곡 메모의
비교 후 저장(CAS)은 동시 저장의 덮어쓰기를 막는다. 업로드 후 저장 실패 시
업로드 URL을 유지해 재시도하며 불확실한 업로드를 즉시 삭제하지 않는다.

검증: Chromium/WebKit에서 어린이 DB 저장 실패/재시도, 기존 메모·다른 버전 보존,
새 브라우저 저장소 복원, 일반 가사와 예배 소유 저장 격리, 송출 상태별 버튼·재생
차단 및 송출 종료/창 닫기 정지 확인. 로컬/공유 세트 이관 호환과 직접 가사·사진
싱킹 회귀 통과. Cloud 로컬 baseline 13 unit + 13 smoke 통과. 모든 DB 쓰기는
격리 double이며 운영 어린이 곡 자료를 새로 만들거나 일괄 이관하지 않았다.


자동 넘김 처음부터 재생은 Audio.load()로 미디어 상태를 새로 준비한다. Linux
WebKit에서 송출 연결 종료 후 currentTime=0만 설정하면 readyState=2에 머물고
play()가 끝나지 않는 경합을 재현했다. 일시정지/이어 재생은 이 초기화 경로를
쓰지 않는다. 실제 버튼 클릭과 HTTP Range 음원으로 처음 재생·창 닫기·재시작을
같은 회귀 검사에서 확인한다.


## Tab, template and archive full-name hints · 2026-10-17

Tab labels, template inventory/draft names and section/element chips, and archive
weekly-status aliases expose their full escaped names using native title hints.
Ellipsis geometry and click behavior remain unchanged. Offline Chromium/WebKit
hover checks use long quoted names at narrow and desktop widths; output, print
and operational data are outside this change.


## 수동 넘김과 음원 재생 · 2026-10-17

송출 중 수동 다음/이전/처음/끝/직접 이동은 자동 싱킹만 해제하고 음원은 계속
재생한다. 같은 음원의 일시정지·이어 재생과 seek도 해제를 유지한다.
‘자동 넘김 재생’을 명시적으로 다시 실행하면 처음부터 재생하며 자동 싱킹을 켠다.
이는 현재 재생 세션의 상태이며 저장된 타이밍·활성 설정을 바꾸지 않는다.
송출 종료/출력 창 종료 시 동기화 음원을 정지하는 기존 동작은 유지한다.

Linux WebKit의 seek 뒤 이어 재생에서 실제 음원이 진행·종료되어도 play() Promise가
완료되지 않는 상태를 재현했다. unpaused·not seeking 상태의 실제 시간 증가도
재생 시작 확인으로 사용한다. 자연 종료는 요청 serial을 무효화하고 pending을
비워 늦은 재생 응답이 종료 상태를 되돌리지 못하게 한다.

## Children version audio attachment - 2026-10-17

Current contract supersedes the earlier song-memo storage design.
mindex_song_versions.audio_set is optional JSONB, applied in production with
explicit user approval. Version1 contains audioUrl/audioName/audioFingerprint
(SHA-256)/duration, starts/enabled, lyricsFingerprint/sourceSignature and forms.
Only children_audio reads this attachment. Worship-owned config.audioTiming is
unchanged. Writes compare version ID, lyric_signature and prior audio_set.

Audio-specific form fragments may carry audioSourceRange=[start,end] into the
NFC/lowercase letter-and-number-only concatenation of version form lyrics.
Every fragment must match its range; sourceSignature guards the complete
original forms. Repeated ranges and blank interlude/outro forms are allowed.
Ordinary lyric forms are not rewritten to fit audio page boundaries. Legacy
song-memo childrenAudioSets remain read-only fallback. Live-output playback
gates and explicit Audio.load() replay recovery are preserved.

38 songs:28 existing versions and10 added children audio versions, including
one new song (승리하신 예수). 문들아 머리 들어라 maps to the existing HisShow song.
Existing28 versions/forms are unchanged apart from audio_set, verified through
production REST readback.30 automatic sets,8 disabled review drafts.
All38 Storage files re-downloaded and SHA-256 matched (229,417,423bytes).
Audio, lyrics, original snapshots and operational SQL stay outside public Git.

## Compact linked praise rows · 2026-10-17

DB lyrics/score rows with their own action toolbar use one row when the input
container is at least961px wide: mode, flexible title, DB link, bounded version
and form, then photo/audio/save. No empty assignee column is reserved; an actual
assignee remains below. Missing versions reserve no column. Smaller containers
retain wrapping. Opening photos moves the action area below; audio managers
retain their full-width area. Direct lyrics and output/print remain unchanged.
Real renderer smoke checks cover three connected songs in Chromium/WebKit at
600/800/1000/1100/1200/1600px, button bounds/overlap, actual photo expansion and the
unlinked layout. Existing praise-input regression covers assignee/direct input.

The individual-input regression previously applied its desktop row-count rule
above780px even though the actual container wraps through960px. The same failure
reproduced with unchanged HEAD styles. Align that condition with the960px
container breakpoint; retain every containment, overlap and multiline assertion.

## Independent photo clock (2026-10-18)

The worship timing editor accepts ordered images and independent photo seconds.
At projection time, merge photo events with effective lyric display events,
retaining the currently displayed lyric until its original next cue. Generated
continuation frames are excluded from lyric editing/fingerprints; original
lyric onset values and the one-second lead stay unchanged. Photos on blank
interludes render alone; lyrics retain their caption over subsequent photos.
Same-clock seek and manual navigation use the existing presenter transport;
manual movement suspends automatic following while audio continues. Original
slide numbering can expand because photo continuations are output frames.
Invalid photo timelines fail closed without changing lyric playback. Stale lyric
or audio profiles cannot generate photo continuations. Photos start no earlier
than the first timed lyric/blank page. Normal background preload/decode gates apply.


## Explicit output stop starts a fresh run ·2026-10-18

Stopping output clears old board selection, PPT progress and pending explicit
slide-launch requests, and resets the controller position to its preparation
slide. Relaunch without a new selection starts there; a selection made after
stop remains the explicit launch target. Live-output reconnection is distinct
and retains its position. Existing music stop/preserve policy is unchanged:
ordinary playing background music survives, synchronized output audio follows
its existing stop rule. No operational data is written.


## Output lifetime and message ownership ·2026-10-18

Each newly opened output receives a session ID in its URL and transport snapshot.
The controller accepts messages only for that session and rejects retired clients
after an output reload. Old close broadcasts are scoped too. An output reload
keeps the session/slide; a fresh launch replaces the session. An existing output
can restore its Window reference via same-origin ready/heartbeat postMessage after
controller reload, without creating or focusing any window.
Disconnect keeps the Window reference and slide: only Window.closed proves exit
and invokes the existing stop/reset path. Missing heartbeat alone does not reset
selection or position. Existing background-music policy and operational data are
unchanged. Offline popup smoke covers close/relaunch, old message types, reload,
reference recovery and temporary disconnect in Chromium/WebKit.

## 2026-10-18 — 어린이 제목 P 재생과 예배 입력 정리

- 송출 중 어린이 음원 제목에서 P (한글 배열 KeyP 포함)로 기존 자동 넘김 재생 경로를 호출한다. 컨트롤러와 출력 창 모두 지원하며 오디오는 컨트롤러에서만 재생한다.
- 입력창·대화상자·IME 조합·수정키·키 반복은 제외한다. 이미 재생/준비 중이면 재시작하지 않는다. 출력 창 요청은 현재 예배·슬라이드 인덱스·타이밍 그룹이 일치해야 한다.
- 예배 편집의 어린이 입력 영역은 반복 설명/음원 관리 제목을 없애고 미리 듣기·파일명·P 안내·타이밍 작업을 한 줄에 배치한다. 좁은 화면에서는 줄바꿈한다. 타이밍 편집 대화상자와 DB 저장 계약은 유지한다.

## 주간 날짜 중복 안내 제거 · 2026-10-18

- 주간 카드 날짜 머리글은 `M/D`만 표시한다. 중복되는 `오늘 ·` 접두사는 제거하고 `오늘 예배` 상태 문구와 오늘 날짜 강조·접근성 표시는 유지한다.

## 2026-10-18 — 자동 넘김 복귀와 박자 맞춤 편집

- 어린이 음원 송출에서 R 또는 음원 위치 아래 `자동 넘김 복귀 · R`로 수동 전환 때문에 해제된 자동 넘김을 복구한다. 현재 음원 시각의 가사/간주로 맞추며 audio.load/play/seek 없이 이어 간다. 전주 중에는 동일 구간의 제목으로 복귀한다.
- 현재 송출 예배·음원·타이밍 그룹만 허용한다. 다른 예배/음원, 정지/준비 중, 안전 빈 화면, 실시간 성경 송출, 입력/대화상자/IME/수정키/키 반복에서는 복귀하지 않는다. 삽입 미디어 경계와 최신 출력 세션 검증을 유지한다.
- 음원·타이밍 편집창에 박자 분석, BPM(40–240)과 기준 박 수동 지정, 새 기록의 박자 맞춤, 각 장 ±0.2초 조정을 제공한다. 직접 입력/미세 조정/기존 저장 시각/사진 별도 시각은 자동으로 박에 붙이지 않는다. 가사 1초 선행 표시는 기존 송출 단계에서 한 번만 적용한다.
- 분석은 사용자가 요청할 때 이 기기에서 오디오를 8kHz로 디코딩하고 Worker에서 10ms 간격의 spectral flux·자기상관·전체 구간의 위상 일관성을 확인한다. 대략 60–190 BPM 후보를 찾으며, 무음·불규칙 박자·템포 변화·확신이 낮은 결과에서는 중단한다. 주기와 위상을 곡 전체에 맞춰 미세 탐색하여 정수 BPM 반올림 누적 오차를 피한다.
- 결과는 음악적 정답/가사 시작 시각이 아닌 편집 보조 후보다. 분석 후에도 맞춤은 꺼져 있으며 사용자가 확인해 켠다. 기준 박은 듣고 수동 조정할 수 있다. 분석은 100MB·10분 이하로 제한한다. 음원 교체/대화상자 닫기/수동 기준 편집 이후의 오래된 분석 응답은 적용하지 않는다.
- 박자 설정은 현재 편집 세션의 보조값이며 저장 버튼으로 기록된 시각만 기존 version audio_set/예배 audioTiming 경로에 저장한다. 운영 38곡을 자동 수정하거나 별도 DB/Notion을 만들지 않는다. 원본 음원·가사·폼·사진과 CAS/atomic 저장 규칙을 유지한다.

검증: 실제 WAV 디코딩/Worker 분석/무음 거부/음원 교체 초기화/직접 입력·미세 조정/DB 저장·재조회/R 및 실제 메뉴 버튼 복귀를 Chromium·WebKit에서 통과했다. 순수 테스트는 무음·불규칙 박자·템포 변화 거부와 소수 BPM 누적 오차를 확인했다. 보관 음원 3곡의 후보 검출은 확인했으나 음악적 정답이나 전체 38곡 정확도를 인증하지 않는다. 로컬 기존 smoke_output_session_isolation의 WebKit 창 닫기 실패는 변경 전 main(2cc1330b)에서도 재현됐고, 나머지 20개 smoke와 16개 unit 검사는 통과했다. Linux 전체 검사는 배포 파이프라인에서 별도 확인한다.

## Browser output close waits for fullscreen · 2026-10-18

Script-driven browser output close coalesces duplicate requests, waits for pending
fullscreen entry, then awaits fullscreen exit before closing. Controller stop
still resets immediately and retains the established audio stop/preserve policy.
Startup/delegated entry share the same pending operation; a closing output cannot
start another entry. If native exit fails, leave the window available for native
close and permit retry rather than destroy it mid-transition. Electron's existing
window-close path is unchanged. No lyric/photo timing or operational data changes.

Mac Playwright WebKit 2248 crashed in WebFullScreenManagerProxy /
WKFullScreenWindowController when a window closed during native fullscreen entry.
The same failure reproduces without app code; waiting for fullscreen exit removes
it in the minimal reproduction. App rapid-stop regression exercises real fullscreen
startup in both engines; native-close/session regression leaves fullscreen first.
This mitigates app-driven close, not the browser's independent native close button.

추가 검증: 같은 음원이 다른 순서에서 재사용돼도 재생 시작 당시 timingGroupId와 일치하는 순서에만 복귀한다. 최신 main의 전체화면 종료 안전 수정을 통합한 뒤 기존 WebKit 송출 창 검사도 통과했다.


## Union-only hymn numbers · 2026-10-18

The bundled score manifest is keyed by new-hymnal numbers. A source song with
`통 N`/`통일 N` must not resolve that number to a new-hymnal score or be admitted
as a new-hymnal score song. Lyrics remain available. Existing songs with an
explicit numeric new-hymnal number keep their current score mapping, including
linked old-edition lyric versions. No existing service links are rewritten.

## 전체화면 대기 안내 굵기 · 2026-10-18

전체화면 예배 대기 화면의 윗문구는 font-weight 600을 직접 지정한다. 기존 공통 meta 기본값도 600이었으며, 공통 토큰 변경과 무관하게 유지하기 위한 고정이다. 문구 크기·아랫문구·로고·배경은 유지한다.


## Compact assignee and audio preparation · 2026-10-18

Assignee-only board fields omit the enclosing card padding/background. Non-children audio management uses a full row below the inputs, with a compact label, player, filename and actions; controls wrap at narrow widths. This is controller CSS only; saving, playback, output, print and operational records are unchanged. Actual app renderers were checked offline in Chromium/WebKit at 1200, 800 and 390px with external requests and native fullscreen/window opening blocked.


## Offering projection separation · 2026-10-18

All-generations defaults remain prayer-only unless configured otherwise, but an explicitly populated offering hymn is retained. Offering labels are distinct during duplicate collapsing and positional fallback matching; a hymn cannot donate its song/version to a prayer. Legacy title-person offering prayers with a linked song are split in memory into a deterministic hymn projection and the original prayer identity/person. Existing output mode and form are retained on the hymn; source objects are untouched, with no migration or production writes. Repeat projection does not duplicate recovered hymns.

Assignee-only cards now follow the user's corrected reference: no visible 담당 label, full-width input inside the usual padded card. Accessible input names remain.


## Controller action alignment · 2026-10-18

Single-element DB shortcuts sit beside the board element heading, independent of inline song controls. Their input-grid column is removed. Multi-song rows retain their individual song DB links. Output start/stop and 전체 화면 share one row with 35px controls and 10px gap; the obsolete three-slot window-controls layout is replaced inside the side panel. Display wording includes the space in 전체 화면; action identifiers and output behavior are unchanged. Chromium/WebKit renderer checks cover 1600–600px board widths and ready/live mocked commands in a 260px panel without opening any output window.


## Editor button surfaces and save feedback · 2026-10-18

Photo disclosure, audio upload and save actions share a 30px bordered field-surface button with hover and visible keyboard focus. DB remains the heading link. The per-item saved text is empty because success is already toasted; modified/saving/error feedback and busy disabling remain. Song-form photo placement remains functional and unchanged: it attaches a reference image to a specific progression group, unlike timed photo playback. No stored media, timing or production records are changed.


## Lyric parenthetical text · 2026-10-18

Paired ASCII/fullwidth parentheses in praise lyric slides, including the delimiters, render at 80% of adjacent text size in the shared output/thumbnail renderer. Nested pairs shrink once; incomplete pairs remain unchanged. Highlight ranges, source text, scripture and song titles are preserved. Announcement parenthesis behavior is unchanged.


### 2026-10-18 제목 양식 폰트 정리

- 풀스크린 메인 찬양·입례찬양·기도찬양 제목은 현재 role token과 동일한 150px / 800을 사용한다. 이전 152px 설명을 대체한다.
- 공통 title-content 양식의 주제목과 담당 등 보조 본문 line-height는 1로 통일한다. 해당 양식을 공유하는 preview와 출력에 함께 적용한다. 가사·대기 화면의 행간은 별도 규칙을 유지한다.
- 보조 내용의 크기(담당 100px, 상단 순서명 80px, 곡 설명 60px)는 이번 변경에서 유지한다.

- 찬양 제목 앞 ♬는 글리프의 시각적 크기를 고려해 .55em으로 표시한다(기존 .72em보다 축소). 제목 auto-fit 시 음표도 함께 축소되며 기존 baseline 보정은 유지한다. 공통 음표 규칙이므로 fullscreen·chromakey·preview에 함께 적용한다. 실제 시각적 균형은 출력 화면에서 추가 확인이 필요하다.

## 2026-10-18 · Device names and photo timeline editing

Presence groups controller tabs within one browser profile using a shared reporter
and an editable device name; IDs are not displayed. A device is output-active when
any fresh tab is active. Other browser profiles remain separate devices. See
`monitor-operations.md` for expiry and storage restrictions.

The worship audio timing editor supports per-photo replacement/removal, absolute
audio seconds, recording the current audio time, or linking to a lyric slide start.
Optional `photos[].slideIndex` follows the existing display lead (lyrics 1s, blank
0s). Absolute entries keep their old cues. Atomic worship save owns the bundle;
photo editing never changes lyric cues by itself. Generic photo output uses the
lower 20% caption area and instrumental sections have no caption. Existing
Cadaros photos/cues are not migrated. See `audio-lyrics-sync-runbook.md`.

### Direct photo timing entry · 2026-10-18

Audio-led worship items expose `사진·타이밍 편집` in their item action row.
It opens the existing timing editor and focuses the photo section. Opening the
shortcut does not save, mutate lyric starts, or change absolute/linked photo cues.
The existing audio synchronization entry remains available.

## Music-only topbar panel · 2026-10-18

The topbar launcher and panel are named `음악 관리` with a music icon. They show
only the selected music, playback/pause/stop, fade-stop preference and audio timing
transport. Output status/return/stop are absent from this panel; screen selection
and always-on-top controls live beside the existing lower presenter controls.
Output and music lifecycles remain independent. This supersedes the combined
송출·음악 launcher description above; saved worship/audio/photo timing is unchanged.

### Fade-stop default · 2026-10-18

`페이드아웃 정지` defaults to checked when no device preference exists. Explicit
on/off choices remain in `mindex.music.fadeStop` and survive reload. The fade
envelope, immediate stop after opt-out, and worship/lyric/photo timing are unchanged.

### Fullscreen order heading and assignee typography · 2026-10-18

Fullscreen order headings (including sermon headings) and assignees use 80 stage
pixels at 1920×1080 and weight 800, in output and its thumbnails. Lower-bar
typography, song titles, scripture, audio and stored worship data are unchanged.

### Offering editor alignment · 2026-10-18

Hymn, special and video offering editors share an in-card toolbar: choice at
top left, one save action at top right. Variant inputs follow below; upload,
background and audio tools follow the inputs. No duplicate outer-header save.
Existing element commits and feedback remain unchanged.

The empty offering video editor omits the redundant file-connection helper;
name, file/link and upload controls remain, as does connected-file information.

### Concise worship editor copy · 2026-10-18

Shared reference/media editors across service types omit the empty file-link
explanation. Upload/name/link controls already describe the action; connected
file details and preview errors remain. The source disclosure drops its redundant
edit/apply caption while retaining the Apply button and save/recovery feedback.
Praise, scripture, prayer/sermon, announcements and source controls retain loading,
validation, historical-date scope, empty-state and non-obvious keyboard guidance.

## Unified worship manual · 2026-10-18

Operations → 예배 매뉴얼 has three groups: worship understanding/department orders,
preparation/live wrap-up, and current Mindex usage. Department order and nested
offering/prayer details follow the Notion 예배 source; preschool's missing order
and unconfirmed Friday scheduling are marked 확인 필요. Reading the manual never
changes templates, services, playback or operational records. Notion originals
remain untouched and are linked in the manual's sources.

`mindex.manuals.js` owns normalized content; `tools/build_manual_docs.cjs` generates
`docs/manuals/operations.md` and `--check` detects drift. App UI groups the same
sections in its contents and body. New code must keep source order, distinguish
absolute photo timing from slide anchors, preserve the music fade preference,
and retain the worship-owned versus children-version-owned audio boundary.

### Compact offering fields · 2026-10-18

Offering cards at container widths of 550px and above place mode/title on one
row and version/form/assignee on the next. Narrow cards retain wrapping; the
shared choice/save toolbar and file editor remain unchanged. No save or data
behavior changes.

Offering choice/save/background/upload buttons use a shared 30px height and
70px minimum width, with 50px choices on narrow cards. Keep the choice/save
positions stable. Praise assignee placeholders show the field name only, without
a repeated inferred example; accessible names and saved assignees are unchanged.


### Source English names and neutral department headings ·2026-10-18

Preserve the Notion 예배 source's English names alongside Korean names, including
Classic Components/Fourfold Order of Worship, all31 numbered department steps,
11 nested offering/prayer entries, and3 Fellowship entries. Keep source order,
parent-child grouping, song counts and meaningful department identifiers TOV/RIA.
Remove descriptive heading adjectives 귀여운/꿈꾸는 and implementation commentary
from operator prose. Retain actionable confirmation labels: preschool order,
Friday scheduling/location and the main-service order must not be invented.

The requested retirement covers only the Notion 예배 page, not the separate
예배 운영 매뉴얼26-Q4 source. Retain source attribution and a private full source
snapshot. Report the page ready for user-led removal only after source coverage,
committed generated documentation, browser readability and production publication
are verified. This change never deletes or edits Notion pages or worship data.

### Controller slide blocks · 2026-10-18

Controller thumbnails share a subtle panel background per contiguous formKey
occurrence or scripture range (including element and translation boundaries).
Repeated forms after another block remain separate; ungrouped title/blank/media
slides remain outside. Background-only row fragments follow the original grid
with an eight-pixel radius: no new rows, padding, thumbnail resizing or gap changes.
Decorations are absolute and pointer-transparent; resize/scale updates reposition
them without changing layout. Slide objects, global indexes, navigation, output HTML and saves
are unchanged. Group labels remain accessible without adding duplicate headings.


## Reviewed hymn playback corrections · 2026-10-18

- Score manifest 4 starts at its beginning, with the preceding duplicate ending removed.
- Score manifest 570 retains one 12-page set; page 2 continues verse 1.
- Score 106 pages 6/9 and 466 pages 6/9/12/15 continue their verse groups; false Verse 1 boundaries are removed.
- The reviewed new-hymnal versions 163/166 include opening alleluias only once per lyric playback plan. The print segno follows the opening. This applies after verse selection, including repeated/reordered verses, using copies only. It never saves inferred forms or rewrites unit IDs/text, worship records or medley order. Other version IDs, explicitly segmented forms and edited nonmatching wording are untouched. Their score opening page is retained once when selecting verses.
- 69/561 have shared endings stored as Chorus. This is an existing classification choice, not a demonstrated missing-lyric error; do not silently rename their referenced form IDs. 262/346 spelling-error claims and 628 melody/other-voice claim were withdrawn after visual review.
- 223 page 8: corrected to 귀한 신분. The 신 syllable and its original eighth-note pixels move 40 px horizontally, with pitch and rhythm unchanged. Only the documented local text/note regions differ. The original WebP remains as evidence; the manifest points to a versioned lossless reviewed asset with a checksum. The renderer must preserve this reviewed override instead of regenerating the typo from the old deck.

Controller thumbnail metadata places form/scripture badges on the left and slide
numbers on the right, including unlabeled slides. Numbers retain their size,
weight and theme contrast and never shrink under long references. Output is unchanged.

Controller whole-group backgrounds use occurrence order within each song: muted
red, yellow, green, cyan, blue, magenta, repeating after six blocks, mixed at 30%
with the panel surface and a three-pixel inset top rule in the full group color.
Green uses deep green and cyan uses sky blue to remain distinct beside chroma-key
slide previews in both themes. The inset rule never changes grid geometry. Form type no longer determines color. Form and scripture
labels are plain text without local fills, including hover; keyboard focus remains.
Scripture range groups use the same six-color occurrence cycle within each scripture
element, keeping continuation pages and wrapped row fragments the same color.
Output colors are unchanged.
Score pages without a new form marker continue the preceding verified form within
the same element, using controller-entry metadata only. Unmarked leading pages
remain ungrouped; never infer verse boundaries or rewrite score manifests.

## Song-form spelling and identity · 2026-10-19

- Full labels separate number, @ and group: `Verse 1 A`, `Verse 1 @ A`. Compact tokens remain `V1A`, `V1@A`. Case and spaces are accepted, including the trailing-@ alias `Verse1 a@` → `V1@A`.
- Explicit numbers are preserved in input normalization, including a lone `V1`; normalization does not infer an unnumbered identity from occurrence counts. This does not migrate stored lyric blocks.
- Hyphens delimit sequence items; whitespace never does. `v - c - c b - tags` becomes `V-C-CB-Tags`, whereas `C-B` is Chorus then Bridge. Legacy comma/arrow/plus separators remain accepted.
- Unknown or ambiguous tokens such as `V1A@B` and whitespace-only sequences are preserved, never guessed or discarded; existing missing-form feedback reports unresolved targets. No operational records are rewritten.

Normalization matrix (`Verse 1`, `Verse1`, `V1`, `verse 1`, `verse1`, `v1` each use every row; spaces may be omitted or repeated between suffix components):

| Suffix input | Canonical suffix | Full suffix |
| --- | --- | --- |
| none | none | none |
| `A`, `a` | `A` | ` A` |
| `B`, `b` | `B` | ` B` |
| `@` | `@` | ` @` |
| `@A`, `@a`, `A@`, `a@` | `@A` | ` @ A` |
| `@B`, `@b`, `B@`, `b@` | `@B` | ` @ B` |

`tests/test_form_input_normalization.cjs` covers 396 spelling/spacing/suffix combinations plus ambiguous tokens, sequence boundaries and repeat preservation. The same aliases apply to Chorus, Pre-Chorus, Bridge and Coda.

## Input boundaries and authored lyric paragraphs · 2026-10-19

- Alias folding is lookup-only at free-input, portable-source and persisted legacy-read boundaries. Fixed selects use strict canonical-code checks; source labels, titles, names and lyrics are not rewritten with folded keys.
- Praise classifications are a set projected in `hymn`, `ccm`, `children` order. Song versions, worship items, forms and lyric paragraphs retain authored order. Bible short-name/alias tables have one owner in mindex.constants.js, including supplemental books.
- DB praise slides use blank-line-separated paragraphs, just as direct lyrics do. One-, three- and longer-line paragraphs each remain one slide; no padding, merging or splitting into pairs. CRLF and whitespace-only blank lines are separators; no saved lyrics are changed. Liturgical text retains its existing separate two-line splitter.
- Existing timing fingerprint validation rejects a profile when page text or boundaries change; require new cues instead of applying old timings to different slides. Running audio/output sessions are not changed by normalization or slide preparation.

- Automatic A/B fallback keeps its existing selected nonempty lines, while retaining blank-line boundaries inside each selected range. Explicit A/B blocks and form ordering remain unchanged.


## Explicit source metadata validation · 2026-10-19

Before applying a portable source edit, validate every explicit element type,
input mode and output mode. Unknown values report the item and field and leave
both source text and all existing items untouched; no partial application or
fallback-to-default is allowed. Empty values and the existing generic 요소 alias
remain compatible. Stored legacy reads are not rewritten or newly blocked by
this edit guard. Direct source-record/creation helpers enforce the same guard.
Worship/service element aliases have one resolver; output modes and preparation
roles use own-property alias lookup, including spacing/case compatibility.
Schema adapters retaining praise input flavor in config/content_state remain.

Legacy service/section identifiers keep exact-key mappings and preserve unknown
strings. Preparation labels also ignore inherited object properties. No alias
lookup may treat prototype names as registered values.


## Praise within liturgical-titled sections · 2026-10-19

A praise element (typed praise, praise label or special-song slot) must not be
classified as a liturgical body from its shared section heading/key. Saved song,
version and form sequence remain authoritative; actual creed/prayer siblings keep
their liturgical handling. This fixes the historical sending hymn under a
projected 공동체고백 heading without rewriting sections, elements, forms or links.


## Private draft handoff and legacy timing links · 2026-10-19

Draft arrivals update an explicit handoff list, never a running editor or output.
Restore requires the original document baseline, no dirty fields, and no active
save/playback/output. Separate author keys retain concurrent drafts; pairing only
shares the dedicated private draft namespace, not device journals or recovery.
See `server-state-current.md` for connection and failure behavior.

Legacy timing links preserve the original target identity. Worship-occurrence
profiles use the existing atomic worship save; version profiles use version CAS.
Different existing public timing is never silently replaced. Verify uploaded audio
bytes and read back the saved attachment; keep legacy originals. The audited
production MR already has public timing, but eight of nineteen cues differ from
the retained legacy copy. Its public file passes independent SHA-256 validation;
no operational timing replacement was made during this audit.

## Retire legacy audio runtime ·2026-10-19

User authorized retirement after current public attachments were verified. Public
version audio_set and worship audioAsset/audioTiming are now the only active
sources. Removed IndexedDB initialization/import, private profile manifest reads
and writes, memo.childrenAudioSets fallback, portable binary sharing and the
legacy-link dialog. Earlier local-profile descriptions above are historical.
Retained original stores/files are recovery evidence only; no data deletion or
operational row rewrite is part of this release. Current version CAS, atomic
worship saves, lyric validation, P/R and photo/beat controls remain unchanged.
DB-only tests reject any legacy store access and exercise both current sources;
current DB browser suites supersede the retired local-profile smoke scripts.



## Preserve populated closing hymns · 2026-10-19

All-generations projection may omit an empty inherited 폐회찬송 slot, but must
retain one with saved song/version identity, a real title, manual lyric blocks
or media. Both the initial regular-slot filter and unmatched-extra filter use
this rule. Form presets alone do not make an empty template slot populated.
A populated hymn cannot match the closing image by section or ordinal alone.
Explicit suppression remains authoritative. No saved rows or sequence are rewritten.

### Inline editor appearance retained

Inline controller editors have no large panel fill or outer padding. Their row
and toolbar gaps are 5px. Text fields, selects and textareas use transparent
backgrounds and a bottom rule, with a complete accent border on focus and the
2px keyboard focus outline drawn inside the field (offset -2px), without an
outward ring or layout shift. Select arrows, invalid/disabled states,
buttons, automatic textarea heights and output rendering remain intact. This
exception applies only inside servicePresenterControls subgroup editors.


## Citation translation editor · 2026-10-19

Each citation shows its reference and translation selector without nested
disclosures. Direct input is a selector option; only that mode shows the
translation name and multiline body. Existing manual citations are visible
immediately, including the older single-reference manualScripture shape.
Viewing does not migrate saved data. Explicit edits adopt that old shape into
the per-reference payload. Switching to a DB translation captures pending
text in manualInputDraft; switching back restores it. This optional memo draft
is not output content, and manualInput retains an empty editor across renders.
Hidden fields cannot overwrite the selected DB mode during save. Each reference
has an independent deferred-input key. Existing atomic save and output resolution
remain unchanged; no production records are migrated.
## Explicit worship order, no dedication-driven hiding · 2026-10-19

Users manage the actual service order directly. The dedication checkbox and its
automatic special-song/offering visibility mutation are retired. Existing
dedication metadata is inert for template visibility; no new content-inference
rule is introduced. New afternoon orders expose special song and offering so
users may fill or delete them. The section editor uses add/move/delete, with no
separate item hide action. Third-service templates no longer generate empty
hidden new-family/assurance placeholders; those can be added explicitly.

Previously saved empty hidden elements are converted only through an explicitly
authorized, revision-guarded data cleanup into normal template-slot deletion
markers. Filled rows, lyrics, forms, medley links and their relative order remain.
Deletion markers prevent template resurrection and are distinct from presentation
hiding. Compatibility reading of legacy hidden data, imported PPTX slide flags
and invalid-media safety exclusions remains; do not remove renderer safety flags.


## 통일 전용 곡의 장 번호 부제 중복 표시 · 2026-10-19

통일 전용 곡의 `hymn_no=통 N`과 정확히 일치하는 `subtitle=통일 N`은
찬양 목록/상세 설명과 예배 곡 제목의 부제에서 제외한다. 서로 다른 번호,
실제 별칭·원제·일반 곡 부제는 유지한다. 데이터는 삭제하지 않는다:
현재 부제는 canonical variant key에도 쓰이므로 저장 식별 규칙을 분리하기
전에는 지우지 않는다. 검색, 버전 이름, 판본 번호와 source/canonical ID,
가사·송폼·메들리는 변경하지 않는다. 제목 슬라이드의 일반 부제 우선순위와
찬송가 판본 번호 재배치는 별도 후속 작업이다.

검증: test_union_subtitle_display.cjs, 운영 snapshot 77곡의 Chromium/WebKit
로컬 렌더링 및 식별값 보존. 이 기록은 배포 완료를 의미하지 않는다.


## 공통 버전 출력 제목 · 2026-10-19

찬송가뿐 아니라 모든 찬양 버전에서 선택적인 출력 제목을 지정할 수 있다.
버전 관리에 ‘버전 출력 제목’ 입력을 제공하고 비우면 곡 대표 제목을 쓴다.
English 이름이나 원제에서 자동 추론하지 않는다. 선택한 버전의 제목을 곡
제목 슬라이드와 예배 곡 제목에 적용하되, 목록의 대표 제목·버전 이름·ID는
유지한다. 기존 찬송가 번호 장식과 부제/원제 우선순위는 이번 변경 범위 밖이다.
저장/재조회 방식은 version-name-preservation.md의 versionOutputTitles 계약 참조.
운영 schema 변경·기존 데이터 보충·배포는 이 로컬 구현 완료와 구분한다.
