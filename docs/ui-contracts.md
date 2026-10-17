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
- Week headers use `주일` for Sunday and keep weekday/date labels at readable
  row size and contrast, including days with no service.
- Today stays visually highlighted and explicitly labeled even without a service;
  its day section exposes `aria-current="date"`.

- Worship is the primary operational area.
- Home shows the week dashboard: `이번 주 예배` plus `다가오는 예배`.
- The Worship/Service tab opens to the weekly board (`최근 예배`) by default.
  `전체 예배` remains a separate list action (navigation commit `91fba0fd`).
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

The Scripture edition selector lives above sidebar search and controls both the
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
