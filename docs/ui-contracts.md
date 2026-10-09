# Mindex UI Contracts

Read `HANDOFF.md` first. This file is the short UI contract for Codex threads so layout work does not require rediscovering the same app-shell rules.

## Shell

- At widths up to 900px, only the shared outer nav sidebar owns drawer positioning. Inner sidebar panels remain in normal layout in every module; no praise/presenter fixed-position exceptions or second topbar offset.

- Praise sidebar filters use three equal columns: all/empty/review, then hymn/CCM/children. Keep this 3-by-2 layout at every sidebar width; do not override it with auto-fit.

- Detail pane page padding: `25px` by default and `15px` at viewport widths up
  to `860px`, with bottom safe-area padding via the `--content-pad-*` tokens,
  unless a feature has an explicit fullscreen/presenter reason to override it.
- New app-layout spacing should use the shared `5px`/`10px` rhythm instead of
  adding one-off numbers.
- App UI typography is separate from presenter output typography. Use the
  compact app scale by role: labels `12px / 700`, supporting metadata
  `12px / 500`, normal rows and form controls `14px / 600`, card titles
  `16px / 700`, and page titles `20px / 700`.
- Weight should communicate hierarchy, not decoration: primary labels and
  titles may use `700`, routine editable values should usually use `600`, and
  helper/meta text should stay at `500` unless it is an actionable label.
- Icon sizing follows a separate glyph rhythm because Lucide-style interface
  icons are optically tuned around `16px`: use `16px` for normal icons, `14px`
  for dense helper icons, and `20px` for large home/action tiles. Topbar buttons
  stay `40px`; normal icon buttons stay `35px`; dense inline controls may use
  `30px` or `28px` only when they sit inside compact editor/tool rows.
- Sidebar open or closed must not change the detail pane gutter.
- Topbar icon buttons are square, `40px` by `40px`.
- At viewport widths up to `560px`, the topbar uses two rows and is `90px`
  tall; the module tabs occupy the second `40px` row.
- Sidebar toggle, home, theme, and save controls should share the same button geometry.
- Left topbar actions align to the left rail edge. Right topbar actions align to
  the right rail edge because they belong to the app-level utility side.
- Mindex brand/home buttons may navigate home, but should not add hover motion.
- Avoid horizontal page overflow on desktop and mobile.

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
- Search should read as an independent surface on the sidebar through background
  contrast, not a visible stroke. Focus may strengthen the surface tone without
  adding an accent or border line.

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

- Worship is the primary operational area.
- Home shows the week dashboard: `이번 주 예배` plus `다가오는 예배`.
- The Worship/Service tab opens to `전체 예배` by default. `이번 주 예배` remains
  a secondary sidebar panel, not the default Worship tab landing screen.
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
- At widths up to 560px, the existing page tabs remain visible in a second
  40px header row. Tabs scroll horizontally, expose their close commands on
  touch screens and keep the active tab in view after selection or resizing.
  Module destinations and utility actions retain the first header row; the
  drawer starts below both rows. No separate mobile navigation state is stored.
- Page tabs use `13px / 600`; the active tab uses `700`. The add-tab control is
  a `40px` square command with a direct neutral hover surface and a centered
  `16px / 1.5` Lucide Plus icon.

## Sidebar

- The left sidebar separator paints one pixel outside its right edge, in the
  same pixel column as the first active tab's inset left separator. Keep the
  wrapper unclipped and above adjacent content so the stroke remains visible;
  do not change column widths to compensate for stroke placement.
- Sidebar width should stay consistent unless a module has a strong reason.
- Sidebar row padding should align visually with the sidebar toggle x-position.
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

- Calendar is a home utility, not a Praise or Scripture filter.
- Active calendar handling starts at `2025-11-30`.
- Opening Calendar should scroll to the current month when data exists.
- Header summary may show church year and series, such as `2026 · Series A`.
- Fixed feasts may appear visually, but should not behave like editable Sunday services.

## Presenter

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
