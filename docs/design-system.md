# MINDEX Design System

This document is the stable UI design grammar for the app shell. It complements
`docs/ui-contracts.md`: this file owns reusable design tokens and migration
rules, while `docs/ui-contracts.md` owns screen-level behavior contracts.

## Runtime Owner

`mindex.design-tokens.js` owns the small set of app UI tokens that need to be
shared by multiple screens without turning `app.js` into a styling glossary.
It loads after `mindex.constants.js` and before `mindex.presenter.js`/`app.js`.

Mindex owns its design tokens locally. Workspace EX-series tokens and
`tools/check_ex_shell.py` do not govern this product. Existing numeric values
may remain where they serve the workflow, but future changes are judged by
ministry operations, live presenter reliability, accessibility, and internal
consistency rather than cross-product parity.

Keep presenter output typography and layout rules in `mindex.presenter.js` and
`styles.presenter-output.css`. The design-token file is for the controller app
shell, navigation, buttons, labels, and shared UI copy.

## Token Rules

- Use the current `5px` rhythm for shell spacing and `10px` steps for larger UI spacing.
- Use the local typography ladder before adding a new one-off size:
  `12/600` labels, `12/500` metadata, `14/600` rows and controls,
  `16/700` compact titles, `22/700` page titles.
- Controller badges, taxonomy metadata, setlist hymn numbers and song details use
  the 12px metadata token; do not shrink these with percentage/em font sizes.
  Source-panel labels use 12px / 600; auth and live scripture values use 14px / 600.
- Use established icon sizes before adding local values: 14px helper, 16px normal,
  20px large. Navigation rail and tab-bar controls both use 16px.
- Use the established 1.5 stroke for Lucide controls. Scope icon defaults to `.lucide`,
  never all SVGs; document previews and illustrations own their dimensions.
- Size both Lucide placeholders and rendered SVGs when styling an icon control.
- Use established button sizes: 40px topbar, 35px icon, 30px dense, 28px compact.
- Do not add accent color to neutral shell controls. Accent is for selected
  state, primary creation actions, or explicit attention.

## Button Grammar

- Sidebar and ambient utility actions should be icon-only with an accessible
  `aria-label`.
- Use text labels only when the command is primary, destructive, or ambiguous
  without text.
- Primary creation buttons may use accent fill; repeated inline add controls
  should stay visually quiet.
- Danger buttons must remain visually distinct from primary actions.

## Service Navigation Copy

- The root page tab label is `홈`; it names the location while the wordmark names
  the product. The internal route remains `home`.
- Home tab default: compact date and this-week worship start page; full week board remains an explicit `최근 예배` destination.
- Module rail defaults: show each module’s centered verse landing and its module name.
  Worship’s weekly board (`최근 예배`) opens explicitly from the sidebar.
- The weekly board groups this week and next week; `전체 예배` remains a separate list action.
- Service list title: `전체 예배`.
- Template surfaces should not appear as ordinary default navigation unless
  the user is explicitly managing templates.

## Migration Rule

Do not split `styles.css` or mechanically move large UI blocks without smoke or
visual coverage. The safe sequence is:

1. Document the rule.
2. Add or reuse a token in `mindex.design-tokens.js`.
3. Replace narrow repeated literals.
4. Add smoke coverage if behavior can regress.
5. Only then extract larger CSS or JS modules.


## Semantic surfaces · 2026-10-17

The controller uses three opaque neutral surfaces in both themes: canvas
(`--ui-surface-canvas`), panel (`--ui-surface-panel`), editable field
(`--ui-surface-field`). Sidebar/chrome/cards share panel; nested grouping uses
spacing or a separator, not another shade. Legacy bg/panel/panel-2 aliases map
to these roles. Do not add percentage mixtures for routine neutral surfaces.
Hover may use field; selection uses accent-soft, a semantic state rather than
a fourth neutral depth. Editable inputs keep the same surface on every module.

Accent marks selection/current location, actionable links, primary execution
and active playback. Routine headings, counts, group labels, upcoming dates,
ready-but-idle statuses and auxiliary upload buttons stay neutral. Incomplete
or invalid input uses warning; failed/destructive work uses danger; confirmed
success uses success. Text and explicit labels remain alongside status colors.
Focus uses a visible accent outline. Placeholder ink is solid secondary text.

Slide artwork/chromakey/preview content, presenter-output stylesheet and printed
bulletin styling are excluded. Do not derive output colors from these UI roles.


## Control rhythm and feedback ·2026-10-17

Prefer multiples of5 for spacing/control dimensions, then even values. Keep
justified values such as1px borders,14/16px icons and the typography ladder.
Text utility controls have10px horizontal inset and5px icon gaps; bare DB links
and square icon targets retain their distinct roles. Neutral utility buttons
use transparent rest/field hover rather than an invisible panel-on-panel box.
Primary buttons retain accent colors and gain an inset hover ring; warnings,
keyboard focus and disabled feedback remain explicit.
Live scripture uses10px outer inset/padding, a20px heading/checkbox line,10px
heading-to-input gap and35px input. The previous28px checkbox row added invisible
vertical centering space above the heading. Controller toolbar/panel controls
also use35px. Output artwork and bulletin print rules are outside this cleanup.


## Disclosure headers ·2026-10-18

Worship authoring panel headers and per-item settings summaries use the field
surface on hover and a2px inset accent outline for keyboard focus. Apply these
to the actual summary, not its details body; native Enter/Space toggling stays.
Per-item summary metadata is plain text with5px gaps, without panel-colored
pills or their horizontal padding. Preserve truncation and warning semantics.

## Device-status control · 2026-10-18

The icon-only device-status button inherits the standard topbar hit target;
remove obsolete text-button width/padding overrides. Both the Lucide placeholder
and rendered SVG reserve a centered 16px box. The global playback smoke checks
this at desktop and mobile widths and is included in the offline release gate.

## Unified editor fields ·2026-10-19

Single-line text, date/month, number and selection fields share 35px height,
10px horizontal inset, 5px radius and14px/600 type. Dense worship rows, section
editors and praise block controls use30px through --ui-field-height. Selects
reserve25px for the same chevron across engines; native selection behavior stays.
Textareas retain content sizing/resizing and their lyrics typography, with10px
insets and no border that would invalidate scrollHeight autosizing. Native
checkbox/radio/range retain their hit targets and use the accent; file pickers
retain filename and native selection. Search/transport geometry is excluded.
Warnings, disabled and keyboard focus stay explicit. Section template actions
use outlined neutral buttons with a plus,35px target and10px gaps; item-add
buttons align to their30px editor row. Screen-only; no output/print changes.


## Recognizable sidebar controls · 2026-10-19

Praise and Scripture filter buttons retain a neutral field surface, visible
border and 5px inset at rest. Selection uses accent fill/border; hover changes
the surface without losing selection, and keyboard focus has a separate outline.
Do not apply the bare DB-link style to filters. Keep Praise 3-by-2 and Scripture
4-column grouping. Presenter sidebar context uses a neutral bordered surface;
its left text column stacks title, date, then temporal status. The icon-only
35px launch control sits vertically centered against the whole text column,
with its existing start/stop tooltip and accessible name. Stop remains
danger-colored. This is appearance only: output lifecycle/data stay unchanged.

Sidebar summary hierarchy: keep the 16/700 title, 12/500 date and 12/500 neutral
temporal status. Today retains a 12/600 accent label in the same third row;
status changes never move or resize the launch control.

Reference view/editor and background-management card utilities use a neutral
field surface with a visible border at rest, stronger hover and 5px action gaps.
Keep existing target sizes, danger/disabled semantics and focus outlines.
Scope this to those card toolbars; navigation links and output are unchanged.

Reference group tools, version management and lyric block tools follow the same
card-utility surface/border/hover rule. Do not dim entire lyric toolbars; only
disabled controls are muted. Version deletion remains danger-colored at rest.
Selectable version/linked lyric cards use the shared 2px accent focus outline,
while preserving whole-card selection and all existing action handlers.

Song timing and draft-handoff dialogs share the neutral utility button
surface/border/hover rule for secondary actions. Timing save uses the existing
primary style; preserve its disabled/busy handling, hover ring and focus outline.
This is dialog chrome only; timing, playback and persistence logic are unchanged.
