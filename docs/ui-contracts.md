# Mindex UI Contracts

Read `HANDOFF.md` first. This file is the short UI contract for Codex threads so layout work does not require rediscovering the same app-shell rules.

## Shell

- Use one desktop shell at every viewport width: a persistent 260px left sidebar, a single 50px topbar, and an in-flow right panel. No mobile drawer, auto-collapse, portrait navigation variant, or stored sidebar-collapse state.

- Praise sidebar filters use three equal columns: all/empty/review, then hymn/CCM/children. Keep this 3-by-2 layout at every sidebar width; do not override it with auto-fit.

- Detail pane page padding: `25px` by default and `15px` at viewport widths up
  to `860px`, with bottom safe-area padding via the `--content-pad-*` tokens,
  unless a feature has an explicit fullscreen/presenter reason to override it.
- New app-layout spacing should use the shared `5px`/`10px` rhythm instead of
  adding one-off numbers.
- App UI typography is separate from presenter output typography. Use the
  compact app scale by role: labels `12px / 600`, supporting metadata
  `12px / 500`, normal rows and form controls `14px / 600`, card titles
  `16px / 700`, and page titles `22px / 700`.
- Weight should communicate hierarchy, not decoration: primary labels and
  titles may use `700`, routine editable values should usually use `600`, and
  helper/meta text should stay at `500` unless it is an actionable label.
- Icon sizing follows a separate glyph rhythm because Lucide-style interface
  icons are optically tuned around `16px`: use `16px` for normal icons, `14px`
  for dense helper icons, and `20px` for large home/action tiles. Topbar buttons
  stay `40px`; normal icon buttons stay `35px`; dense inline controls may use
  `30px` or `28px` only when they sit inside compact editor/tool rows.
- Opening the right panel must not change the detail pane gutter.
- Topbar icon buttons are square, `40px` by `40px`.
- Home, theme, and save controls share the same button geometry at all widths.
- Left topbar actions align to the left rail edge. Right topbar actions align to
  the right rail edge because they belong to the app-level utility side.
- Mindex brand/home buttons may navigate home, but should not add hover motion.
- Keep inputs responsive inside their panels. The screen canvas has a minimum
  width of `max(700px, left sidebar + 320px content + right panel)`; below it,
  horizontal page scrolling keeps all controls reachable. This minimum is
  screen-only and must never constrain printed bulletins.

## Color And Surfaces

- Keep `accent`, `warn`, and `danger` semantically distinct in both themes:
  accent is primary/selection, warning is incomplete attention, and danger is
  destructive or failed work. Do not make them aliases of one another.
- All normal-size text on a solid UI surface must meet at least WCAG AA `4.5:1`.
  Accent-colored text needs a text-safe accent token; do not reuse a low-contrast
  decorative fill color for labels or buttons.
- Keyboard focus must remain conspicuous in both themes: use a `2px` accent
  outline with an offset rather than a low-contrast neutral hairline.
- Shell controls should stay neutral. Theme, navigation, and disabled save
  buttons should not pull accent color into the app chrome.
- Use accent for active/primary/data emphasis, such as selected rows, brand
  accent, enabled primary save/present actions, and linked/reference states.
- Search shares the global field surface; focus uses the same visible accent outline as other editable controls.

## Navigation

- Global search Enter navigation consumes result objects, not rendered markup.
  Ignore IME composition confirmation and stale queries after async lookup.
- Scripture result labels and click navigation retain the ending verse.
- Praise global search includes loaded lyrics in every module, supports hymn
  number labels and title/artist combinations, and ranks exact field matches
  above cross-field matches. Cross-field matching is opt-in for global search;
  worship automatic matching is unchanged.
- The count describes displayed matches, excluding the Bible text-search action.

- 예배 검색 결과는 `7월 19일 주일예배 [3부]`처럼 날짜와 정규 예배 종류를
  한 줄로 표시한다. 요일, 예배 별명, 설교 미리보기는 검색 결과 행에 붙이지 않는다.
  검색 매칭과 클릭 시 열리는 예배는 기존 동작을 유지한다.

Primary app modules:

1. `service` - Worship and presenter work.
2. `praise` - Song database.
3. `scripture` - Bible/search/copy tools.
4. `calendar` - Home utility.
5. `references` - Home utility.

Home hierarchy:

- The Home action resets the detail and list scroll positions. Re-rendering the
  current screen still preserves scroll normally.
- The dashboard and sidebar `전체 예배` actions share the same navigation handler.
- Home sidebar worship shortcuts open the same presenter working surface as the
  central Home worship buttons. Navigation changes the screen before awaiting
  detail hydration; selecting a worship record never starts output. Explicit
  `최근 예배` and `전체 예배` destinations remain available from the sidebar.
- Week headers use `주일` for Sunday and keep weekday/date labels at readable
  row size and contrast, including days with no service.
- Today stays visually highlighted and explicitly labeled even without a service;
  its day section exposes `aria-current="date"`.

- Worship is the primary operational area.
- Home summarizes all five modules equally: this-week registered worship count, bulletin-linked departments, known Praise catalogue size, installed Bible editions, and operations/calendar context. It never renders a service order/editor or duplicates the sidebar catalogue. Counts use loaded data only, exclude expected/no-gathering services, and distinguish unknown/read errors from zero. Bulletin department counts describe eligible linked services, not saved/published issue counts. Home triggers no service-detail fetch. Module headers and operations links use existing guarded navigation.
- Module rail icons open verse landing pages titled 예배, 주보, 찬양, 말씀 and 운영.
  Re-clicking an icon clears its selection/search after the existing unsaved-edit
  confirmation. Page tabs, history and explicit detail links retain their target.
  `최근 예배` and `교회력` are sidebar destinations, not default rail targets.
- Praise and Scripture are major resources.
- Calendar and References are home utilities.
- Template structure is an internal management concept. Do not surface it in
  the ordinary home/sidebar worship path unless the user is explicitly editing
  templates.
- Prefer direct action labels over explanatory copy in operational screens. If a
  button already says what will happen, do not add a nearby sentence that repeats
  it.

Inactive module tabs should stay visually quiet. Active tabs may show a clearer label and accent.

- When two or more page tabs are open, tabs can be dragged to reorder them.
- The active page remains active after reordering, and the new order is persisted with the existing tab session state.
- The add-tab control is not part of the draggable sequence.
- Every page-tab render hydrates its own icons, including title/history refreshes.
  Close controls remain visible on tab hover or keyboard focus; a lone home tab
  has no close control.
- Page tabs remain in the single header row, scroll horizontally, and keep the
  active tab visible after selection or resizing at every width.
- Page tabs use `14px / 600`; the active tab uses `700`. The add-tab control is
  a `40px` square command with a direct neutral hover surface and a centered
  `16px / 1.5` Lucide Plus icon. Active tabs use continuous full-height 1px side separators and mask the
  bottom border edge to edge inside the 50px topbar.

## Sidebar

- At every width, the module strip and sidebar form one continuous
  left panel: same background and right boundary, with no horizontal divider
  between module navigation and search. Module controls and search remain fixed;
  only the list scrolls.

- Desktop's left-panel right boundary is drawn once by the full-height shell,
  one pixel outside the sidebar edge. Do not split it between header and list
  shadows or duplicate it on the first tab. Active-tab bottom masking is inset
  one pixel on each side so it never erases the vertical strokes at corners.
- Sidebar width stays at 260px, independent of viewport orientation.
- Sidebar row padding uses the shared sidebar spacing tokens.
- Sidebar content should feel relaxed, not cramped.
- Home utility pages should keep the integrated Mindex search available.

## Empty States

- Home, Praise, and Scripture empty states should use the shared UI verse system when available.
- Do not hardcode live content into empty states.
- Setup errors may name the required SQL file, but should not become a visually separate design system.

## References

- Reference links are database-managed.
- Groups are the organizational model. Avoid category/description UI unless there is a new product need.
- Groups should be editable and reorderable.
- Link move buttons inside a group should reorder only within that group.
- Group move buttons should move the whole group.
- References should remain visually neutral unless the design system intentionally changes.

## Calendar

- Metadata and headers use 12px; table body uses 14px / 500. Editable
  values use 14px / 600 while focused.

- Upcoming Sunday uses an accent date-edge marker and its date label, not a
  full-row accent fill. Hover uses a neutral surface; keyboard editing uses a
  stronger neutral cell surface and inset outline, independent of date status.

- Calendar is a home utility, not a Praise or Scripture filter.
- Active calendar handling starts at `2025-11-30`.
- Opening Calendar should scroll to the current month when data exists.
- Header summary may show church year and series, such as `2026 · Series A`.
- Fixed feasts may appear visually, but should not behave like editable Sunday services.

## Presenter

- Preparation input rows reserve 55px for labels with a 5px column gap.
  Longer labels wrap without covering the flexible value input.

- The right-panel slide navigation row groups number input, total count and
  jump command on the left; previous/next remain on the right. Use a 48px
  input, 34px square command buttons and a 34px row with tabular numerals.
  The jump icon has a tooltip and accessible label. Do not change keyboard
  navigation or blank/invalid-number behavior for visual alignment.

- With the right panel open, the start command beside the preview is primary;
  the left start command remains available with a neutral surface. Closing the
  right panel restores the left command's accent. Stop styling and button
  dimensions do not change with this hierarchy.
- Bulk worship input remains expanded. Keep drafts, inline per-line examples,
  focus and save/apply behavior intact; do not add automatic collapse.

Presenter details live in `docs/thread-worship-presenter.md`. Keep shell edits out of presenter internals unless required for integration.

- Chromium may suppress CSS transitions inside the `service` and `presenter`
  modules to keep worship loading, thumbnail sizing, and live controls stable.
  Keep that safeguard scoped to those operational modules; home and resource
  modules should retain their normal interaction feedback.
- Dense presenter status, navigation, help, and section metadata must still use
  the shared `11px` label and `12px` metadata scale. Reserve smaller text for
  nonessential thumbnail annotations only.

## Individual Save Draft Retention

- The header save command must preserve the editor DOM, current draft, focus,
  and text selection while its response is pending and after failure. Failure
  re-enables retry; retry reads the current fields, not the previous snapshot.
- An older successful response must leave newer typing marked modified. Only
  success for an unchanged input snapshot may display saved.
- Repeated identical feedback does not rewrite matching DOM text/attributes.
  Compare each target value, rather than skipping solely on editor status, so a
  replaced header/status node still receives its current label and busy state.
- Cross-app source: STUDEX `dbSaveEntry` retains drafts when its conditional
  update is not confirmed; VITEX `backup_once` distinguishes local verification
  from cloud upload. MINDEX adopts the confirmation boundary, not their storage
  mechanisms or an implied server transaction guarantee.
- Regression: `python3 tests/smoke_header_save_draft_retention.py` exercises the
  real header renderer and commit/feedback lifecycle in Chromium and WebKit,
  with deferred persistence doubles. It does not verify production writes,
  cross-client conflict rejection, durable recovery, or multi-row atomicity.

## Assignee Terminology

- 전역 UI에서 개인·단체 공통 입력 label과 placeholder는 `담당`으로 통일한다.
  `title_person` 유형의 표시명은 `제목 / 담당`이다. 특송도 같은 용어를 사용한다.
- `인도`, `설교` 등 구체적인 역할명은 유지한다. 옛 담당 명칭을 위한 레거시 별칭과
  기본값 판별은 두지 않는다. 예배 DB 10개 테이블 전수 검사에서 옛 명칭이 없음을
  확인한 뒤 해당 호환 처리를 제거했다 (2026-09-06).
- 내부 `person`/`assignee` 필드와 DB 값은 이 용어 정리를 위해 변경하지 않는다.

## Bulletin Workbench

- Keep service selection, history, save, and print in the primary toolbar; source
  reload actions stay in the quieter secondary row, with errors visible there.
- Content/layout controls and the preview header share a 45px height. The desktop
  inspector is 300px wide; narrower workbenches use 240px before stacking.
- Respond to the workbench container width, including when the app sidebar is
  open. Do not infer available editing width only from the browser viewport.
- Preview face controls scroll to the existing outside/inside sheets without
  switching documents, changing output, or resetting edits.

- Bulletin face navigation indicates the sheet with the greatest visible height,
  updates on scrolling/resizing, and is disabled until sheets are available.
- Respect hidden recovery actions in CSS. Saving shows progress on the existing
  save button; normal successful saves do not add a persistent status sentence.
- Source-action tooltips distinguish reloading the saved bulletin from refreshing
  its worship/calendar source. Short scripture references use a single-line input.

## Setlist archive record scope

- 역대 콘티 includes actual imported worship records and saved worship services,
  regardless of date or whether praise items are filled in.
- Do not synthesize missing departments or empty weeks from a weekly template.
  Preserve explicitly recorded 집회 없음 and mark saved services without praise
  as 콘티 미등록.

## Worship date context

- Past-service date labels remain plain text with no badge background or border.
  Keep the date wording and historical editing notice; sidebar today/upcoming
  labels retain their existing plain accent treatment.

- Week boards and service cards explicitly distinguish 지난 예배, 오늘 예배 and
  다가오는 예배 by local calendar date, without relying on color alone.
- Past-service controllers and order editors show the full date and explain that
  edits save to that historical service. These cues never enter output slides.

## Announcement region editor geometry

Announcement region labels stack above their textareas inside worship boards.
Reset the board's inline-field flex basis inside this column editor; otherwise
its 220px basis creates an empty vertical gap. Keep common fields collapsed by
default and use the shared compact disclosure rhythm. Verify open/closed states
at desktop and narrow widths with `tests/smoke_announcement_editor_layout.cjs`.

Announcement editors use a transparent, horizontally unpadded board container
and 5px textarea side padding to avoid nested panel gutters.

## Scripture loading ownership (2026-10-14)

- Returning to a memory-cached or browser-cached Bible chapter immediately
  clears the reader loading state and displays its text. Completion or failure
  from another chapter must not replace it or clear a newer chapter's loading.
- A successful saved-scripture list request is complete even when it returns
  no visible rows. Tab reentry reuses that result; explicit refresh still reads
  the database, and a new client connection resets the completion marker.
- Regression: `tests/smoke_scripture_loading.py` (Chromium and WebKit).

- Concurrent first entries share the in-flight saved-scripture/reference-list
  request. Explicit refresh after completion still performs a new read; errors
  release the request so retry remains available.
- Bible chapter reads share an in-flight request per translation/book/chapter.
  A quick A → B → A return waits for the original A read, and only the currently
  selected chapter owns reader text, errors, and loading completion.
- Concurrent-entry regression: `tests/smoke_loading_reentry.py`.

## Initial loading identity

- Until authentication and the initial active-page data settle, show the existing cross silhouette and MINDEX
  wordmark at viewport center, respecting the saved/system light or dark theme.
- Keep the first paint self-contained (inline SVG/CSS), with one short reveal,
  no looping animation and no artificial minimum loading duration. Existing
  runtime readiness dismisses it after those requests complete or fail. Background
  catalog warming does not block entry. Signed-out users reach sign-in without
  waiting for unavailable data. The top-left cross remains a static home button;
  it never becomes a global loading spinner. Later loads use their own view status.
- Reduced-motion mode is static. The status is named for assistive technology
  and becomes hidden after readiness. Presenter output routes never show the
  branding; their existing black startup and safety behavior remain unchanged.


## Setlist archive under Operations (2026-10-14)

- Move the archive entry from the worship/home sidebar into the Operations
  navigation alongside calendar, references and worship manuals (`setlists` route).
- Reuse the same archive records, filtering, song links and service links. Opening
  a service enters its worship screen; Back restores the archive search, view,
  month and scroll. Existing legacy archive links remain readable.
- This is navigation only: no record migration, backfill or worship writes.

## Recent worship heading and boot motion

- The recent-worship tab supplies the page title. Its body starts directly with
  the first week heading/date; keep All Worship on that same row, not a separate
  empty title/action row. Search results retain their contextual heading.
- Boot reveal uses a short ease-out rise, with a slight wordmark stagger. Keep
  child animations alive during overlay dismissal so a fast load does not snap
  them to their end positions. Readiness still controls dismissal without delay;
  reduced-motion and presenter-output exclusions remain in effect.

## Tab-owned headings

- All Worship, Setlist Archive, Calendar, References, Manuals and Bulletin use
  their tab title instead of repeating a large generic body heading. Preserve
  contextual search headings, selected content titles, dates and editing fields.
- Keep setlist view controls/count/refresh on one wrapping toolbar. Keep calendar
  year context/view tabs and reference summary/create actions, with compact header
  padding. Manuals start with their specific introduction without extra top padding.
  Bulletin begins with its service selector; save, print and history remain intact.

## Resource UI rhythm

- Empty states fill the detail pane's available content height, without adding
  viewport-based overflow. Missing song/scripture descriptions render no empty row.
- Resource edit/delete and song-form controls use 30px dense geometry; metadata
  dialogs use 35px inputs/close controls, 12px labels and 14px editable values.
- Legacy page-title CSS aliases and JavaScript tokens match the documented
  12/14/16/22 scale. Presenter output and bulletin print typography stay separate.
- Manuals and calendar use 5px/10px spacing. Calendar labels may wrap within the
  existing horizontally scrollable table; never shrink essential text to fit.

## Operational utility geometry

- Unsaved-change dialogs wrap actions within the viewport, including 320px, and
  scroll internally in short windows. No save/discard semantics change.
- Background inputs and upload/download actions align at 35px.
- Presenter toolbar utility containers retain the documented 34px slot; nested
  zoom/music controls use 28px. Preserve the toolbar's horizontal scrolling.
- Conflict review and section editor use the shared typography and 5px/10px
  spacing rhythm. Section editor contents scroll without losing draft or focus.


## Startup branding and recovery · 2026-10-15

- Keep the centered cross/MINDEX identity. Both marks fade in together from transparent over
  500ms with ease-in-out, without position changes or stagger. Exit opacity
  takes 220ms. When initial data
  finishes early, complete only the running reveal before exposing the shell.
  Reduced-motion users have no reveal or artificial minimum wait.
- Initial auth/data readiness still owns dismissal. Never reopen startup
  branding for later background requests or restore the home-icon spinner.
- Release lookup aborts after 3s and uses the index-pinned version. Required
  styles must load before scripts execute; CSS and script loads fail after 15s.
- Asset/runtime failures show an inline-styled accessible recovery screen with
  a manual retry; hide the incomplete shell. Keep presenter-output failures
  black rather than showing app recovery UI on the projection screen.
- Manual retry requests fresh asset URLs, bypassing cached failed preloads,
  without clearing storage or saved content. Remove the retry stamp from the
  address bar after capturing it. Normal startup retains normal asset caching.

## Restored Scripture text search (2026-10-15)

On initial reload, a persisted Scripture text query reruns after translations
load, preserving its selected translation and result page. A changed query,
translation or module, a read error, or a user search already in flight suppresses
this restoration. The initial loader still settles all required reads.
Regression: tests/test_bible_search_restore_20261015.cjs; actual browser reload
restored the combined GAE JER33:10–11 result without another Enter press.

## Worship editor spacing (2026-10-15)

- Keep combined title/form/assignee/media rows, but separate preparation fields by
  10px with 35px input height. Use balanced 15px input-rail padding.
- Give board editors and the expanded source panel 15px padding; separate
  board subgroups by 20px and their headings/content by 10px.
- Preserve narrow-window wrapping and scrolling. Do not recreate a mobile view
  or enlarge presenter output/printed content to loosen editor spacing.

## Publisher HAN source cache (2026-10-15)

All1189 chapters of the explicitly adopted HAN electronic edition use the
han-bsk-canonical-20261015 key suffix by stable translation UUID, including
before translation metadata loads. Prior KRV repair keys and their content
remain recoverable; other canonical scopes are preserved. Explicit combined
1SA30:30–31 resolves a31 lookup once, without duplicating its included body.

## Publisher-directed Easy source cache (2026-10-15)

All1189 chapters of the adopted GODpia Easy electronic corpus now use
easy-godpia-canonical-20261015 keys by translation UUID, before edition metadata
loads. Prior scopes and persistent originals remain recoverable; source literal
combined labels retain their complete body through reference lookup and output.
No old XML heading is used as canonical paratext when the source omits headings.

Slot music controls remain with their worship item. Rendering them must not select or load the shared audio source; slot-owned playback is not exposed by the generic toolbar. Navigating or rendering never stops active audio.

Live scripture drafts are keyed by service ID. Foreign-service clear actions do not change live output or invalidate pending requests; foreign show actions cannot replace an open output. Slot music ownership includes service ID as well as source URL. A foreign service cannot pause, stop, adjust volume, or replace active/pending playback; opening a view never changes playback.

## Plain informational labels (2026-10-16)

Worship date status, linked-song `Linked`, subsection sequence labels and background
registry `등록됨`/`기본` use plain text without decorative fills or badge padding.
Keep their wording/colors, missing-background warnings, interactive focus outlines
and selectable control surfaces. This applies only to controller UI, not output
slides or bulletin print.

Scripture sidebar filters occupy four equal columns in one row (전체, 구약, 신약,
제2경전/외경). The longer label may wrap inside its own cell at narrow widths;
never give the supplemental category a separate full-width row.

Changing Bible editions synchronously refreshes the sidebar filter, book list
and visible count before starting reader/search requests. Search-mode switches
must not retain the previous edition catalogue; unavailable supplemental books
reset to the existing GEN/all selection before rendering.

The Scripture edition selector lives below sidebar search and above the filters,
so global search stays first in every module. It controls both the
book catalogue and reader/search results. Reader/search controls do not repeat
it. Keep the sidebar select DOM stable during renders to preserve focus. Hide
it outside Scripture, and disable it while the edition catalogue is unavailable.

Edition switches clear verse selections/anchors, normalize unavailable chapters
and empty testament filters before persisting or syncing the URL. Source-native
verse numbers are not assumed to align across editions. Empty reader/search
states retain their message but do not repeat edition buttons; use the sidebar.


## Controller essentials and conflict choices · 2026-10-17

The presenter keeps preview, slide navigation, start/stop, blackout and live
scripture immediately available. Live scripture follows the preview, followed by always-visible `예배 순서 입력`
fields and Apply in the right controller. The separate order editor retains
structural editing without a duplicate preparation form. Screen detection and always-on-top live in the `송출·음악` popover.
A compact topbar launcher opens it without widening tabs or extending a sidebar.
State refresh preserves the open panel; Esc closes it without stopping output.
`송출 종료` and `음악 정지` use explicit text and keep independent owners/actions.
The launcher is available before output in Presenter and across modules during
active output/music. Blackout uses the existing jump-to-zero pipeline and is
available only for this service's open output.

Conflict review labels pending fields as `내 편집 항목`, not proven conflicts.
`편집 계속하기` closes without saving and works even when inspection fails.
`초안 보관 후 최신본 열기` retains the existing draft archive and revision guards.
Show the first differing source line and offer inspection retry after read failure
or unresolved save outcome; never imply automatic merge or successful save.


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


Worship loading/error content fills the available detail pane height, with its
normal asymmetric content padding removed only while that state is present.
Do not center within a capped 480px/vh block. Chromium/WebKit layout checks
measure actual content centering across five viewport sizes and both themes,
including the failure/retry state. Regular editor padding is unchanged.


## Full-pane empty/loading alignment (2026-10-17)

Center the common loading skeleton only when it is a direct detail-pane child.
Embedded list skeletons retain their normal flow and padding. No-gathering and
deferred past-service notices use the shared centered empty-detail layout.
The deferred action uses the existing data-open-presenter-service handler in
both service and presenter contexts; sidebar-only data-service-id cannot open
a service from the detail pane. No production data, output or print changes.
Offline smoke_empty_state_layout.py covers Chromium/WebKit, four viewport sizes,
both themes, nested loading preservation and actual deferred button clicks.


Worship lyric/photo timing uses the song's existing board controls and one
dialog. Show form labels and photo thumbnails in ordered cue rows. Sequential
recording follows the preview audio clock; individual timestamps remain editable.
Start synchronized playback explicitly; pause/stop/seek stay in the existing
송출·음악 panel. No new permanent sidebar or production timing auto-save.


## Praise workbench refinement ·2026-10-17

Keep the existing side-by-side version comparison and three-by-two sidebar filters.
Group version copy/add/delete controls separately from praise-type tags. Version
names use14px text; the active header uses a thin accent border/left inset rather
than a filled accent panel. Lyric blocks use16px/25px text,15px padding and10px
internal spacing, with30px controls. The toolbar labels its block-add actions.
Empty active versions offer first-verse creation; inactive empties offer selection.
Adding a block focuses and reveals its new lyrics field. No song/version data is
rewritten by rendering, and confirmed deletion/linked worship guards remain.

Praise visual refinement: version columns and headers share15px gutters. Lyric
cards use panel surfaces without nested outlines; editable fields retain the
shared field surface and10px inset. Keyboard focus stays explicit. Review-warning
backgrounds retain their semantic styling; empty states use the same quiet panel.


## Single-song board controls ·2026-10-18

Single lyrics/score song rows share the medley inline control layout, including
when their section label/title header is visible. Mode, song, version, form,
photo disclosure, audio upload and Save occupy one row in a wide container.
The header retains navigation and warnings; it does not duplicate action buttons.
Narrow containers wrap, and expanded photos/audio management stay below.
No input values, song/version links, medley order or persistence behavior change.


찬양 출력 유형의 표시 순서는 DB: 가사, DB: 음원 (어린이),
DB: 악보 (새찬송가), 직접 추가: 가사, 직접 추가: 음원이다.
기존 내부 mode 값과 기본값 lyrics_db는 유지한다. 어린이 음원에는
가사·송폼·음원·자동 넘김을 함께 불러온다는 안내를 표시한다.

## Synchronous theme switching ·2026-10-18

Apply the entire controller palette in one style update. Suppress CSS transitions
only during that update, then restore normal hover/disclosure transitions before
returning. Do not animate opacity or replace editor nodes. Refresh only the theme
button icon; keep other icons, focused fields, selection, scroll and textarea
geometry intact. Presenter output documents retain their own transition rules.

Theme suppression must resolve descendant computed styles before being removed.
A body-only style flush can leave nested presenter controls transitioning later.
Read-only real-tab DOM replay covers Scripture, service board, presenter inputs
and bulletin editor/preview in Chromium and WebKit; no service data is saved.


## Praise version comparison

- Version columns share row heights by displayed block position, including linked songs. Editing/read-only headers reserve the same 30px minimum. Longer lyrics expand the corresponding row in every column; shorter versions do not fabricate lyric blocks. This is visual alignment only and never changes forms, order, or source lyrics.

- Song form UI labels separate numbered parts from A/B and put a space before @ (Verse 2 B, Chorus @, Verse 1 @A). Stored/copy labels and canonical playback tokens are unchanged; readonly editor rendering formats the label only at display time.


## Worship entry and controller rail

- Presenter topbar utilities align to the fixed right rail width and continuous left boundary. Existing playback controls remain mounted; navigation never restarts transport.
- Operations leader inputs use 30px minimum height, 5px/10px padding, standard corners and visible keyboard focus. Content width includes padding; blur-save behavior is unchanged.
- The manual DB refresh button and module-wide refresh entry point are removed. Explicit service navigation and tab re-entry check that service only after hydration, with a bounded wait. Drafts, saves, output, navigation and input races defer application. Source song records, transport and other services are not replaced. A failed fetch retains current content.

- Reselecting the currently open worship service retains the mounted editor, caret, selected item and clean fingerprint. Each navigation invalidates prior entry requests before awaiting navigation; completed responses require the same entry token. Deferred text is protected even without a modified-status badge.

- Worship sidebar announcement entries show their label only, like liturgical entries. Announcement source text and output are unchanged.

- Presenter text-item assignees use an internal 담당 placeholder instead of an external label; filled inputs show the name only and keep aria-label.

- Reference-screen titles, attached-file names and site-link titles use internal placeholders without duplicated external captions. Retain explicit accessible names, values and persistence attributes; other field labels remain unchanged.

- Link groups use an internal placeholder and explicit accessible name. Reference editor columns align at the bottom without stretching caption-free inputs; URL captions and focus indicators remain.

- Worship item settings use 30px single-line input/select controls with identical vertical sizing. Keep field captions, focus styling and the existing multiline textarea sizing/resizing unchanged.

- Timing dialogs constrain audio/photo file selectors to the available content width and wrap unbroken audio filenames. Labels, focus styles, multiline sizing and audio/playback/save behavior remain unchanged.

- Worship sidebar section dividers stay attached to the heading and leave 15px before the list (10px heading margin plus 5px section gap). Preserve title padding and list-row spacing.

- Manual table-of-contents activation (click or Enter) scrolls only the detail pane and focuses the target heading. Preserve the app hash route and browser history; never invoke fragment navigation.

- Operations navigation order: 교회력, 예배 매뉴얼, 역대 찬양 콘티, 참고자료. Manual source links remain external new-tab anchors with noopener/noreferrer; TOC links alone scroll internally.

- Home weekly worship cards show abbreviated scripture references and the sermon assignee separated by ` / `. Omit the separator when either value is empty; allow wrapping and expose the complete metadata on hover. This is display-only and does not rewrite worship records or output/print references.

All app verse screens use one 45-character (including spaces) wrapping rule.
Sentence punctuation splits first; long segments split at commas and then word
boundaries. Input newlines and repeated whitespace normalize to one space. There
is no module-specific comma rule or manual line-break mode. Source text stays intact.

## Module verse landings ·2026-10-20

NIV defaults: service Psalm95:6; bulletin Psalm133:1; praise Psalm96:1; scripture
Psalm119:105; operations1Corinthians14:40. Stored UI-verse records override these
small display defaults; Bible corpora and operational records are not rewritten.
The home weekly board is retained. Operations has its own `operations` route;
calendar/manuals/setlists/references remain explicit sidebar routes with their
existing titles. Root landing snapshots contain no selected detail or search.

NIV source checks: [Psalm95:6](https://www.biblegateway.com/passage/?search=Psalm+95:6&version=NIV),
[Psalm133:1](https://www.biblegateway.com/passage/?search=Psalm+133:1&version=NIV),
[1Corinthians14:40](https://www.biblegateway.com/passage/?search=1+Corinthians+14:40&version=NIV).

Built-in verse defaults apply to normal landing/empty views. Unavailable/read-error
views retain their existing message or stored UI verse; defaults cannot hide a new error.


### Static shell icons and announcement labels · 2026-10-20

Normal app startup hydrates static shell icons after caching DOM refs, without
depending on a later detail renderer. Restored and empty tabs retain icons on
reload. Presenter output uses its existing separate initialization.
Announcement editor disclosure reads 상하단 문구; fields read 상단 / 하단,
including accessible labels. Stored content and output remain unchanged.
Coverage: tests/smoke_shell_icons.py (offline Chromium/WebKit).


### Quiet server persistence ·2026-10-20

Routine background state/draft persistence does not show a global progress
banner. Failed persistence keeps the actionable warning and retry button; the
pending queue and beforeunload protection remain unchanged. No success toast
is added. This changes only the bridge status presentation, not save receipts.


### Week today marker and sidebar filter inset ·2026-10-20

The current day has a 2px accent inset border and an accent date with a small
오늘 marker, even without services. Preserve aria-current=date and separate
service temporal labels. Sidebar filters share the search/translation 15px
horizontal inset; button padding, focus and grouping remain unchanged.


### Bible source disclosure placement ·2026-10-20

Place 출처·판본 directly below reader controls so it is reachable without
scrolling through a chapter. The native disclosure and its nested review record
start closed. Source text/history/links remain available on request. This
supersedes the earlier bottom-of-chapter placement; preserve all source evidence.
### Concise explanatory copy ·2026-10-20

Keep helper copy in the order scope, next action, then necessary caveat. Avoid
repeating scope or save completion across adjacent paragraphs. Preserve distinct
service-only versus shared-version effects, one-second lyric lead, manual-switch
behavior, failure/recovery choices and source evidence. User-authored content,
manual body, projection text and print content are outside editorial cleanup.

Timing dialogs consolidate repeated save scope; photo-specific guidance stays
with photo controls. Empty states describe the current state or useful next
action. Manual source links need no redundant prose footer. Use 송폼 for forms
and explicit keyboard instructions (same-item newline versus next item).

### Presenter topbar alignment correction · 2026-10-20

Presenter topbar utilities use the same 40px slots, zero gap and centered icons
as the left module buttons. Remove the presenter-only right-rail header width,
separator and 35px overrides. This supersedes the fixed-rail toolbar clause;
output controls in the content sidebar do not move. Add/Save edit buttons share
70px width, 30px height and 16px icon slots; Save uses the shell's save icon.

Popup copy: unsaved-change choices are explained by action labels. Beat setup retains existing-time preservation, with variable-beat guidance in an initially closed, keyboard-accessible disclosure. Photo filenames stay on individual photo rows; no repeated aggregate list.

Home uses a compact wordmark/date header and a five-module overview with shared neutral surfaces, type and 5/10px spacing. Responsive columns keep summaries visible without a large hero. Errors are local to the affected module and never fall back to scripture.

Service-data detail refresh must dispatch home to renderHomeDetail, including delayed supplemental data and background song completion. Home must not fall through to the service empty-state renderer after initial load.

Praise creation controls and reference header add buttons use the shared neutral utility button surface/border/hover rules. Retain existing30px size, icon labels, disabled state and global accent focus outline; do not restyle other reference-new-btn consumers.

### Peer command icon sizing · 2026-10-20

Presenter toolbar, sidebar, shell navigation and inline editing commands use
16px fixed Lucide slots and 1.5 strokes, including Add/Save and media actions.
Placeholders and SVGs share dimensions to avoid load-time shifts. Small helper
indicators remain 14px; artwork and slide previews are outside this rule.

Lyrics block/first-lyrics creation, service list creation, preparation header item creation and unlinked-song creation share the existing neutral utility button surface/border/hover rules. Existing dimensions, focus, disabled states and creation handlers remain unchanged.

## Hymn measure metadata ·2026-10-20

Praise version cards display read-only approximate stanza and saved-block measure
counts from `mindex.hymn-structure.runtime.json`. Amen/Coda and chorus are separate;
these values never generate or rewrite forms, lyric pages, audio timing or worship
content. Unknown, recitative, partially measured, stale and fetch-error states are
distinct. The same version and unit IDs, kinds and text hashes must match. Editing
lyrics invalidates the visible measurement immediately without replacing editor
DOM/focus; late responses cannot overwrite a newer draft. New version IDs do not
inherit reviewed measurements. See `hymn-musical-structure.md` for evidence scope.

Music management uses a 40px icon-only topbar button. Keep the music icon, active indicator, tooltip and accessible name; the opened panel retains its title.

The nested music launcher participates in the same topbar button selectors as its siblings: 40px fixed slot, zero padding, shared hover face and pressed transform. Its active indicator stays absolutely positioned.

Presenter toolbar music uses 35px height and 10px horizontal padding; sidebar previous/next use 35px square targets. Preparation Apply uses 10px horizontal padding and 600 label weight, matching peer commands.

### Presenter navigation rail ·2026-10-21

오른쪽 제어판의 이전·다음은 기본 상태에서도 테두리/표면으로 버튼임을 구분한다.
번호 입력과 이동 버튼의 부모 높이는 공통35px control token을 사용해 높이 잔차를
없앤다. hover/focus와 disabled 규칙, 송출·음악 동작은 변경하지 않는다.
격리 Chromium/WebKit254/320/390px에서 순서·넘침·실제 배치 확인.

### Home continuation ·2026-10-21

Home keeps the whole-app overview and adds up to six deduplicated recent item
links above it. Deduplicate a song across versions while retaining the latest
selected version. Record concrete worship/bulletin/song-version/Bible-chapter or
saved-scripture destinations, plus operations pages; omit root landings/searches.
Reuse the existing session/server page-tab payload and guarded history restore.
Store navigation IDs and a short label only, never document/draft bodies. Reopening
does not save or start output. Known-deleted/no-gathering destinations are hidden;
unknown catalogues retain captured labels until the normal module read resolves.


### Home catalogue totals ·2026-10-21

Home independently reads the exact visible song count with a HEAD-only query,
and the active edition catalogue (id/name/source marker only). Apply the same
canonical-source eligibility as the Scripture reader. Never load song versions,
lyrics or Bible bodies, change reader selection, or set full-catalogue-loaded
flags. Coalesce reads per client with a one-minute in-memory freshness window;
ignore old-client completions and never replace a different view on completion.
Unknown/error states remain distinct from zero and offer an explicit retry.
