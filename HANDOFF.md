# Mindex Handoff

Last updated: 2026-10-13

Mindex is a church ministry operations app. It is not only a song database and not only a presenter. It should support weekly worship preparation, lyrics/scripture management, worship presentation, calendar, and references while sharing one Supabase-backed data model and one coherent UI system. Activities/event screens are deferred to standalone utilities unless promoted later.

Mindex is an independent product, not an EX-series app. Its name, identity,
shell, visual language, and interaction priorities follow ministry operations
and live-use reliability. It may reuse a verified pattern from another app, but
family resemblance or token parity is never sufficient reason for a change.
`docs/design-system.md` and `docs/ui-contracts.md` govern Mindex design.

This document is the canonical handoff for new Codex/Claude/GPT threads. Read this before editing. Keep changes conservative, verify them, and never undo unrelated local work.

Important behavior changes must be documented in the relevant Markdown contract
or decision log in the same change. If a later task disagrees with a documented
rule, update the document with the reviewed replacement instead of silently
reverting code to an older behavior.

For Worship/Presenter work, also read
`docs/worship-presenter-decisions.md`. Any durable behavior change must update
that decision log in the same change so a later task does not silently restore
an older rule.

For documentation routing, read `docs/README.md`. It separates current
contracts, deferred plans, and historical incident notes so old drafts do not
outrank reviewed decisions.

## Thread Ownership

- **UX thread** owns the user-facing experience: interaction flow, controller
  and presenter behavior, layout, visual states, accessibility, and UI-side
  validation. It may read the data contract to integrate existing fields, but
  must not change the Supabase schema, run data migrations, or rewrite curated
  production records.
- **Data thread** owns the internal data layer: Supabase schema, migrations,
  import/backfill jobs, data repair, canonical record rules, and production
  data integrity.
- Cross-boundary work starts with a handoff: UX records the user-facing
  requirement and expected fields; Data records the schema/data decision and
  reports the stable contract back. Neither thread silently broadens the other
  thread's scope.

## Integrity remediation (2026-10-13)

- Electron 43.7.9 / builder 26.15.3 / updater 6.8.9 and the refreshed pnpm
  lockfile pass a full dependency audit with zero advisories at verification time.
- The history-compaction SQL target correlation is repaired and locally tested;
  no production schema/permission migration was run.
- Canonical-key auditing accepts current app keys and historical import keys;
  artist-aware song identity does not merge homonyms. Worship picker artist
  hints use existing metadata only.
- One verified production correction changed only three section sort numbers
  in the 2026-10-11 afternoon service, revision 34 to 35, through atomic save.
  Read-back confirmed unchanged elements, slides and source document.
- Verification: 93 unit/contract/SQL entry points and 163 offline smoke entry
  points passed; the read-only live suites passed 130 + 128 assertions. The
  final content audit reports zero issues/warnings across all 125 aggregates.
- Verification includes disposable PostgreSQL backup/restore and isolated native
  Electron startup/presenter IPC. Signed OS installation/upgrades and physical
  NTU mixer acceptance remain operational checks, not claims of these tests.

## PPTX integration (2026-10-14)

PPT insertion and basic automatic/click effects are connected to the current
worship presenter. See the current decision log's PPTX section for supported
scope, 500 MiB original-source limit, public-media confirmation, transient effect progress and
verification boundaries. `mindex.pptx.js` lazily loads the licensed local renderer;
no production data/schema/policy change is part of this implementation.

## Repository And Runtime

- Repository: this repo root
- Current app: static HTML/CSS/JS app
- Main files:
  - `index.html`
  - `app.js`
  - `styles.css`
  - `supabase-schema.sql`
  - `scripts/worship-schema.sql`
  - `scripts/activities-schema.sql`
  - `scripts/reference-links-schema.sql`
- Local Supabase config:
  - `.env.supabase.local`
  - `.env.supabase`
- Preferred local server:
  - `python3 serve.py`
  - The app is often tested at `http://localhost:2300`.
- GitHub Pages deployment exists, but do not assume remote pages are updated immediately after local edits. Local verification comes first.

## Global Product Direction

Mindex should become a practical ministry workbench for church media and worship preparation.

Top-level product areas:

1. Worship / Presenter
   - The operational worship preparation and presentation area.
   - Must be reliable enough for live church use.
   - Presenter is the urgent priority.

2. Praise
   - Song database.
   - Canonical song pages with versions and forms.
   - Used by Worship/Presenter, but not subordinate to Worship.

3. Scripture
   - Bible database and lookup/search/copy workflow.
   - Used by Worship/Presenter, but not subordinate to Worship.

4. Home Utilities
   - Calendar, References, and similar support tools.
   - These should not feel like full database modules unless their functionality grows enough.

5. Activities / Event Screens
   - Activities are not exposed as a standing Mindex tab or home module for now.
   - Retreat games, quizzes, and event screens should be built as standalone HTML or small utilities when needed.
   - If a repeated workflow emerges, promote it back into Mindex deliberately.

## Strong Behavioral Rules

- Never overwrite already curated lyrics/forms/data unless explicitly asked.
- When syncing/importing from PPT, use PPT as reference material, not as authority over curated Mindex data.
- If existing Mindex data has been manually curated, preserve it.
- Do not hardcode real content that belongs in Supabase.
- Do not introduce dummy seed data into the app runtime.
- Do not invent song form splits. If uncertain, keep as `Lyrics` or leave for review.
- For hymns, official hymn titles should follow the Korean hymnal source requested by the user, not arbitrary first-line extraction.
- Children’s songs should generally be treated as audio-use lyrics, not manually split into song forms, unless explicitly curated.
- Do not treat a church department’s use of a song as the song’s intrinsic type.
- If one song has genuinely different canonical identities, split pages but provide related-song navigation.
- Keep the UI minimal. Remove decorative strokes, redundant labels, and explanatory copy that does not help live work.
- Use English for functional UI where natural, but worship content and Korean worship terms should remain Korean.

## Data Model Principles

The app is Supabase-centered. Local seeds should not be the source of truth for live content.

Song structure:

- `mindex_songs`
  - Canonical song metadata.
  - Title, subtitle, original title, hymn number, promoted metadata fields.
- Song versions
  - Version-specific title/name and lyrics/forms.
  - Version-level type tagging is important.
  - A song can have hymn/CCM/children-related versions without collapsing all versions into one type.
- Forms/units
  - Use structured forms when curated.
  - Use `Lyrics` when the lyrics are not meaningfully form-split.
  - Form labels should avoid unnecessary numbering when there is only one of that type.

Scripture structure:

- Bible books, chapters, verses, translations are database-managed.
- Copy behavior must support references and no-reference modes.
- Korean references should use spacing between book and chapter, e.g. `창 1:1`, not `창1:1`.

Service/Worship structure:

- Service types should use reviewed stable keys such as `sunday-first`, `sunday-second`, `sunday-main`, `sunday-afternoon`, `wednesday`, `friday`, and `monthly`.
- Special seasonal or temporary services can be grouped as special services instead of being promoted to permanent top-level categories.
- First Friday prayer meeting of each month is replaced by monthly first-day worship where applicable.
- Worship hierarchy is `Service > Section > Element > Slide`.
- Worship elements should be structured records, not loose text whenever possible.
- Praise elements should link to Mindex Praise records.
- Scripture elements should link to Mindex Scripture records or normalized references.
- Activity/game elements are deferred. Do not expose them in the main app shell until a repeated workflow justifies it.
- Detailed Worship terminology, template/type semantics, and examples live in
  `docs/thread-worship-presenter.md`.

Deferred activities structure:

- Activity Event: shared team/score context.
- Game: reusable playable unit.
- Team: name, color, score.
- Score Event: score change history.
- Presenter: projector-facing game display.
- Game-specific details should live in typed tables where useful, not all inside one JSON blob.

## Worship / Presenter Rules

The presenter must support real church operation.

Priority:

1. Live reliability.
2. Faithful worship sequence representation.
3. Fast correction before/during worship.
4. Clear controller UI.
5. Presentation output quality.

Current output concepts:

- Chromakey services:
  - Sunday 2nd, Sunday 3rd, Sunday afternoon, Wednesday, monthly first-day worship.
  - Special services vary.
  - Chromakey color is `#00ff00`.
  - Chroma range is narrow in the real broadcast setup.
- Non-chromakey services:
  - Department services and some prayer services.
  - Use background images.
  - Department worship backgrounds can rotate by two-month theme cycles.
- Youth and young adult department worship can use public-worship backgrounds where specified.

Presenter elements:

- Preparation video / waiting slide should be the first element.
- Praise section should group consecutive praise songs under one praise section when they belong to one led praise block.
- Praise leader belongs next to the praise section, not as the main worship leader.
- Hymns in 1st/2nd service may not have a praise leader.
- Scripture reading should be linked to scripture data and displayed with proper reference formatting.
- Apostles’ Creed is a faith-confession element whose content is the Apostles’ Creed.
- PPTX/Keynote import/reference should be an element type, not a replacement for Mindex data.
- Blank screen should remain an available element.
- Video should be an available element.
- Live scripture lookup during sermon is implemented: the live citation composer sits in the right controller panel, immediately above worship order input in the controller (see `docs/worship-presenter-decisions.md`, "Live Citation Composer And Scroll").
- Pre/post worship music player with volume control is implemented in the controller (`renderServiceMusicPlayer`, slot audio via `SERVICE_SLOT_MUSIC`; covered by `tests/smoke_friday_music.py`).

Presenter UI:

- Controller should feel closer to PowerPoint slide sorter / FreeShow controller, but simpler.
- Presenter control strip should avoid cramming all actions into one line. Keep primary launch/status/jump controls visually separate from music/live-input/navigation actions so controls do not collide at normal desktop widths.
- Presenter controls must be checked at reduced widths; wrapping is acceptable, horizontal overflow or overlapping controls are not.
- Slide thumbnails must match the actual output aspect ratio and layout. Do not enlarge a single slide just because it is alone.
- Thumbnail labels should not invent titles. Use actual section/form labels only when helpful.
- A section can contain multiple slides/forms; show section grouping without making it visually heavy.
- Song form labels can appear near the slide title/section label, but avoid duplicate text such as `주기도문 주기도문`.
- Do not show unnecessary panels like Current/Next if thumbnail control is the primary mental model.
- Keep slide navigation keyboard-friendly:
  - Space/Right/Down: next
  - Left/Up: previous
  - Number + Enter: jump
- Do not expose browser-native title tooltips for dense shortcut text.

PPT/reference rule:

- Existing worship PPTs are reference material for layout and service element structure.
- For past services, each PPT section/slide sequence should map closely to Mindex sections/elements.
- If slide numbers are not continuous within a block, treat them as separate elements unless the PPT clearly groups them.
- For complex cases such as intergenerational praise worship or 3rd-service special music, expect exceptions and manual slide editing.

## Praise Database Rules

Song identity:

- Same title does not always mean duplicate.
- Different title can still be same tune/history, but may need separate canonical pages with related links.
- Examples needing careful identity handling:
  - `살아 계신 주` / `하나님의 독생자` / `Because He Lives`
  - `이 믿음 더욱 굳세라` / `We Will Keep Our Faith Alive`
  - `저 들 밖에 한밤중에` and a children’s version
- Some same-title cases are homonyms, not duplicates. Check subtitle and original title before merging.

Metadata:

- Subtitle, original title, alternate title, artist, lyricist, composer, translator, album, track, scripture reference should be cleanly represented.
- Do not mix subtitle with original title.
- Parentheses in display are derived from metadata; avoid duplicated metadata display.
- `Other title` and `subtitle` may be conceptually close, but merge only when the meaning is truly the same.
- Be careful with English subtitle/original-title capitalization:
  - Main words capitalized.
  - Articles/prepositions/conjunctions lowercased unless first/last word.
  - Preserve user-confirmed exceptions.
- `Come and Celebrate` was user-confirmed as intended.

Forms:

- Supported types include at least:
  - `Lyrics`
  - `Verse`
  - `Pre-Chorus`
  - `Chorus`
  - `Bridge`
  - `Coda`
  - `Tag`
- If there is only one form of a type, avoid unnecessary numbering.
- If multiple of a type exist, use numbered labels.
- Explicit user-entered song forms are operator intent. Do not auto-insert
  omitted Bridge/Pre-Chorus/extra Chorus slides into a `manual`, `forced`, or
  template `default` form preset.
- Do not auto-split by location or repeated pattern without review.
- Children/audio-use lyrics should usually be `Lyrics`, not `Verse 1...Verse 6`.

Praise UI:

- The Praise tab should expose an in-context `곡 추가` action in the Praise detail area, not only through hidden/global chrome.
- New songs should be created as real Praise records with a default version, then opened immediately for metadata and lyric editing.
- Linked songs should be visible in the version comparison area as readonly linked columns, while editing remains scoped to the current song/version.

Review markers:

- Review should be meaningful and version-level where possible.
- A sidebar marker should make it clear which version needs attention.
- Do not use noisy double-ring icons; simple `!` is preferred.
- Do not soften or clear review markers from lyrics until spelling, song-form split, and two-line stanza grouping have all been reviewed.

## Scripture Rules

Search:

- Support direct references:
  - `창 1:1`
  - `창세기 1장`
  - `창세기 1장 1절`
  - `Gen 1:1`
  - `gen 1 4`
  - `암 4 3`
- Do not auto-switch OT/NT tabs merely because a search result belongs there.
- Text search should show results in the main area, not force the sidebar to become result previews.
- Result count should be accurate, not `100+` unless truly paginated that way with controls.

Copy:

- Multiple verse selection must support Cmd/Ctrl click and Shift range selection.
- Cmd/Ctrl+C should copy selected verses.
- If text inside a selected verse is manually highlighted, copy only the highlighted text.
- Copy format should allow reference/no-reference modes clearly.
- Korean copy example:
  - `히 11:6   믿음이 없이는...`
  - Reference, three spaces, verse text.
- English versions should support the same reference inclusion behavior.

Display:

- Book list should show concise metadata only.
- Chapter count can appear like song version count.
- Metadata panes should share visual grammar with Praise.

## Home / Calendar / References

Home:

- Home is not a dumping ground. It should clarify the hierarchy:
  - Worship as the main operational area.
  - Praise and Scripture as major resources.
  - Calendar and References as home utilities.
- Normal Home should prioritize module entry cards over a visible verse. Use data-managed UI verses for empty/loading/fallback states, not as the primary home content.
- Fallback when service data cannot load:
  - Psalm 27:14, NIV.

Calendar:

- Calendar is a home utility, not part of Praise/Scripture filtering.
- Church year starts should not include dates before 2025-11-30 in active calendar handling.
- Calendar should scroll to the current month when opened.
- Calendar header should show year and series where useful, e.g. `2026 · Series A`.
- Church-year fixed feasts should be visually present but not treated like editable Sunday services.
- Do not show unnecessary labels such as `57 Sundays` unless useful in context.

References:

- References are home utility links.
- Reference links are database-managed, not hardcoded.
- Grouping is needed.
- Groups should be editable and reorderable.
- Links should be editable inline from each card.
- Avoid category/description fields if groups already cover the organizational need.
- References should not have a strong independent accent color unless the design system later calls for it.

## Activities Direction

Activities are currently removed from the visible Mindex app shell. Build event/game screens as standalone HTML or small ad hoc utilities unless the user explicitly reopens the Activities module decision.

Scope:

- Rec games
- Quizzes
- Team games
- Retreat games
- Presenter display

Core data:

- Activity Event
- Game
- Team
- Score Event
- Presenter state

Initial game types:

- Puzzle Hunt
  - Puzzle board.
  - Piece discovery state.
  - Team that found each piece.
  - Score changes.
- Quiz
  - OX, multiple choice, short answer, motion.
  - Question display.
  - Answer reveal.
  - Team score updates.
- Physical Game
  - Timer.
  - Score.
  - Supplies.
  - Owner/person in charge.
  - Location.
  - Memo.

If Activities returns later, its empty verse should use the shared UI verse system rather than a one-off implementation.

## UI System Rules

Use `docs/design-system.md` for reusable UI tokens and design grammar. Use
`docs/ui-contracts.md` for screen-level shell, navigation, sidebar, empty-state,
calendar, reference, and presenter controller behavior.

Current UI baseline:

- App shell detail gutters use `25px` by default and `15px` at viewport widths
  up to `860px`, with bottom safe-area padding. Feature-specific fullscreen
  layouts may override these defaults. New local spacing uses 5px/10px steps.
- App UI typography follows the compact role ladder documented in
  `docs/design-system.md`; presenter output typography remains separate.
- Button geometry and icon sizing come from `mindex.design-tokens.js`.
- Sidebar/ambient utility actions should be quiet icon-only controls with
  accessible labels.
- Use the current spacing tokens and `docs/ui-contracts.md`; do not restore
  retired 24px/20px gutter or 32x32 icon-button guidance.

## Testing And Verification

Use the lightest verification that matches the risk, then broader tests before committing or deploying.

Always after JS/CSS edits:

```bash
cd "$(git rev-parse --show-toplevel)"
node --check app.js
git diff --check -- app.js styles.css index.html
```

Schema/data sanity:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 tests/check_supabase_schema.py
python3 scripts/audit_mindex_content.py --json
```

App smoke:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 tests/smoke_app.py
```

Presenter-specific checks:

- Open Worship/Presenter locally.
- Verify no horizontal overflow.
- Verify slide thumbnails maintain 16:9 and do not resize wildly when count changes.
- Verify double-click thumbnail starts presenter at that slide.
- Verify number input + Enter jumps correctly.
- Verify Space/Right/Down and Left/Up only affect presenter where intended.
- Verify non-chromakey services do not flash chromakey green.
- Verify fonts do not flash from one family to another after output opens.
- Verify output slide matches thumbnail, including background, title, lyrics, and labels.
- Verify output-window stop from the output screen does not leave stale heartbeat/monitor state in the controller.
- Verify image/score slides do not swap to a blank frame before the active image is decoded; keep the previous rendered frame until the image is ready.
- Verify lower-bar title/assignee output does not ellipsize long Korean titles or names; text should fit its column and stay vertically centered.

Praise-specific checks:

- Check song count loads correctly above 1000 if applicable.
- Check Hymns/CCM/Children filters and version-level tagging.
- Check review markers are meaningful and version-level.
- Check metadata editor displays the same data that appears in the list/detail display.
- Check copy/export outputs preserve brackets/original-title conventions.

Scripture-specific checks:

- Search `창 1:1`, `창세기 1장`, `Gen 1:1`, `gen 1 4`, `암 4 3`.
- Multi-select verses with Cmd/Ctrl and Shift.
- Copy selected verses with Cmd/Ctrl+C.
- Copy with and without references in Korean and English.
- Verify chapter-level copy.

Calendar/Home/Reference checks:

- Calendar opens at current month.
- Calendar does not show pre-2025-11-30 active church-year data unless intentionally in historical view.
- References list loads from DB.
- Reference group edit/reorder works.
- Home integrated search stays available when opening Calendar/References.

Activities checks:

- Activities should not appear in the app shell unless the module is intentionally revived.
- If revived, event/team/game tables must exist before exposing editing controls.
- Score changes should create score-event rows, not only mutate totals.

Deployment sanity:

- Localhost passing does not guarantee GitHub Pages has updated.
- If GitHub Pages does not show fresh changes, confirm commit/push and Pages build status.
- External access needs anon Supabase config to be available through approved link/config path.
- Do not expose service role keys in public links or client code.

## Current Split For Future Threads

Use two ownership tracks and hand off at the boundary:

1. Data thread
   - Supabase schema, migrations, imports/backfills, data repair, canonical
     Praise/Scripture records, service defaults, and production data integrity.

2. UX thread
   - App shell, controller/presenter interaction, layout, accessibility,
     loading states, and UI-side validation.

Presenter/Worship work often crosses both tracks. UX owns the user-facing
behavior; Data owns persisted contracts and production data changes. If a task
touches both, document the handoff instead of silently changing the other
track's assumptions.

Each thread should read this document first, then inspect current files before editing.

## Data Notes

- 2026-08-09: `예수 우리 왕이여` is intentionally split into two same-display-title songs.
  - Hymn: `hymn_no=38`, `praise_types=["hymn"]`, no subtitle/original title.
  - CCM: `praise_types=["ccm"]`, subtitle/original title `Jesus, We Enthrone You`, version `예수전도단 역`.
  - The CCM canonical uses internal variant key `normalized_title=예수우리왕이여::ccm` only to avoid the unique normalized-title collision; do not merge it back into hymn 38.
- Historical (superseded from service date 2026-10-11; see decisions): Youth worship order intentionally places `광고` before `주기도문`.
  - Template order is `... 결단기도 → 청소년부 광고 → 주기도문 → 반별 모임`.
  - Existing youth services with both sections were updated in Supabase; older imported youth services without those sections were left untouched.

## Final Reminder

The user values practical church usability over technical cleverness. Make the app calmer, faster, clearer, and safer. Preserve curated data. When uncertain, inspect the source data and ask only when a wrong automatic edit could damage real worship material.

## PPT playback handoff (2026-10-14)

`mindex.pptx.js` now owns cross-slide audio lifetime independently of the SVG
page viewer. The presenter decision log defines range/safety stop, object-click
commands, trim, repeat count/duration and media-end dependencies. The vendor
module revision is media2; changing the parser requires invalidating this ESM
cache path as well as the application release. Use `smoke_pptx_conditions.py`
with the existing PPT/media/large-source tests. Real-deck and synthetic-fixture
verification are deliberately distinguished in the decision log.


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


## Linked worship, save conflict review and controller · 2026-10-17

Score/lyrics choices now stay local to each service during linked DB song edits.
Mode-only edits no longer enqueue sibling saves; legacy retry signatures remain
compatible. Content/form guards and all-generation exclusions remain unchanged.
Conflict review clarifies unsaved editing vs archiving a draft and opening latest,
shows the first differing source line, and supports retry after read failure.
Controller core live actions remain visible; preparation/screen settings fold into
`편집·설정` and retain expansion across refreshes. No production data was changed.

Validation: third-hymn sync unit tests, edit-sync/sermon-scope smoke, conflict review
and controller essentials in Chromium/WebKit at desktop/mobile widths, global
playback smoke, and Cloud baseline (7 unit + 5 smoke entry points). This is local
isolated-browser verification, not hardware output or Cloud execution.


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

## Compact runtime / presenter fonts · 2026-10-17

Prepared version `20261017-compact-runtime-fonts` in the isolated release worktree.
Runtime gzip (before concurrent-main reconciliation): 324875 → 255344 bytes.
Common controller presenter fonts: 1940620 → 722648 bytes (62.76% reduction);
output's three preloads: 1462948 → 546004 bytes (62.68%). Rare-glyph full fallback
is retained and may add its original download. CSS gzip grows ~27 KB combined,
so count it when comparing the complete payload.

Local checks: 12 Node + 9 browser-smoke Cloud entry points; 19,296 exact glyph
outline/advance comparisons with unchanged vertical metrics/kern/GPOS; 60 browser
wrapping cases per engine, fresh releases with real font cache and stale-compiled
fallback. Startup parallelism/recovery, latest-source resolution, delayed data,
180-thumbnail fitting, 24 lyric-bound cases per engine, output swaps/blackout,
six caption sizes, manual song timing and lyric input sizing pass. Public/CI
verification follows after reconciling concurrent main. Existing worship data
and the primary dirty checkout remain untouched.

Integrated main through `27e0dc73`, preserving audio-led aggregate persistence,
selected-startup recovery overlap and song-title input guidance. Regenerated
runtime is 325373 → 255717 gzip bytes (21.41% smaller). Final local gate is 12
Node + 11 smoke entry points; integrated startup, input/timing, preview/output
checks pass, including 32 lyric-bound cases per engine with rare glyphs. Exact
font coverage additionally checks disjoint CSS ranges against all source glyphs;
UI fonts retain their original unicode ranges and 11,700 outline/advance checks.

Automatic desktop CI exposed two pre-existing missing package entries:
`mindex.song-timing.js` and `mindex.scripture-repair-display.js`. Both are now
included with `app.runtime.js`; the runtime-file test also recognizes the compiled
filename. `pnpm electron:check` passes (offline only, no credentials/signing or
public desktop release). Startup tests derive speculative source/runtime choice
from the release contract so future deliberate source fallback remains tested.

Public web verification: Pages run 39028460461 (`fee6416d`) succeeded; version
`20261017-compact-runtime-fonts`. Twelve published runtime/CSS/font files match
local SHA256 exactly. CDN gzip app response: 331280 → 258671 bytes (21.92% less).
Ordinary output downloads only the three common faces, total 546004 bytes, with
no duplicate full-font request. Rare glyph fallback remains available.

Public Chromium/WebKit pass: actual save functions with isolated fake RPCs
(full/element save, rollback, linked-service aggregate, inflight drafts, no legacy
fallback), 180 preview fits each with zero clipped/mismatched results (max event
loop gaps 50/42 ms), 32 lyric bounds each including rare glyphs, delayed-media
frame preservation and blackout protection. Network routes disallow real DB
writes; no existing worship was modified or test record inserted. Timing varies
with network/CDN conditions; these byte reductions are not a fixed load-time SLA.

Linux Cloud run 39028269079 passed 12 Node + 11 smoke entry points for the same
web runtime. The packaging/test-only follow-up has its own CI run; no signed
installer, auto-update publication or public desktop release was requested.

Follow-up Linux Cloud run 39028460944 (`fee6416d`) also succeeded. Both macOS and
Windows runners passed the corrected offline `pnpm electron:check`; unsigned
installer CI is separate from web deployment and does not publish an update.

## Entry-time measurement and follow-up · 2026-10-17

The compact runtime byte reduction alone was not used as a latency claim.
Native fresh Chrome/WebKit contexts, read-only GET/read-RPC guard, same service,
three runs per engine distinguish shell/current home data/board/font readiness.
An initial diagnostic found WebKit unnecessarily requesting the 2 MB full UI
font (17–24s font-ready samples; board appeared much earlier). A separate routed
before/candidate crossover reproduced full-font requests only before the fix;
WebKit font-ready median was 5.442s before /3.050s candidate. These routed runs
are a controlled mechanism check, not native-cache timing benchmarks.

Fixes: disjoint supported-glyph fallback range (no glyph/file deletion), one
completed-home render after state restoration, and no whole-editor render for
background scripture-book lookup. The default gate adds a module-change/error
unit test; font checks cover supported rare Hangul plus unsupported Han without
wasted full-font downloads. Font cache fixtures share the existing 128-backlog
HTTP server; original request/boot deadlines and assertions are unchanged.

Integrated main through `1baf08a9` preserves audio timing resave, boot activity
indicators and editor-pane bounds. Final release measurement/verification follows.

Final pre-deploy native sample on `20261017-compact-boot-progress` (3 fresh
profiles/engine, same service): Chrome shell/home-current-data medians 2.030/4.231s,
first visible board 3.446s, font/visible-fit readiness 5.827s, reentry .178s.
WebKit corresponding medians .929/2.197s, 1.236s, 8.835s, .205s. Individual
WebKit font readiness was 33.492/8.835/8.632s; full UI font transfer was present.
Earlier diagnostic runs had different network conditions and are kept separate.
Native samples retain HTTP cache within each profile, with no request interception;
only JS write guards are installed. The full font-ready measure includes hidden
font loads and must not be described as the first visible frame time.

Final integration also preserves upstream `239312a6` (compact boot feedback,
weekly/input UI and audio-fixture metadata readiness). Runtime version remains
`20261017-entry-font-scope`; no production data/schema/write path change.

Final integrated local gate passed 13 Node +12 smoke entry points. Scoped current
input/editor, 180-thumbnail fit, scripture lookup, 32 lyric-bound cases per engine,
output swaps and blackout checks passed. Existing read/write guards, atomic save
and font/fit thresholds remain unchanged. All source glyphs remain covered with
11,700 exact UI glyph/weight outline and advance comparisons.

### Entry performance: deployed verification (2026-10-17)

Published with upstream loading UI changes in `9375ee38`, release
`20261017-unified-loading`. Pages run 39031119615 and Linux Cloud web checks
39031119854 succeeded. Public SHA-256 matched 12 checked local files, including
source/runtime, entry HTML, CSS, release manifest and six presenter common fonts.

Three fresh native-cache profiles per engine, same read-only service, medians:

| Measure (seconds) | Chrome before / after | WebKit before / after |
| --- | --- | --- |
| Shell visible | 2.030 / .900 | .929 / 1.571 |
| Home current data | 4.231 / 1.563 | 2.197 / 2.207 |
| Service first visible board | 3.446 / 1.656 | 1.236 / 1.592 |
| Fonts and visible fit ready | 5.827 / 2.023 | 8.835 / 2.971 |
| Same-view reopen ready (NOT home reentry; corrected below) | .178 / 1.091 | .205 / .336 |

Before was `20261017-compact-boot-progress`; after was the release above.
These small sequential live-network samples do not establish causal speedups for
all timings. WebKit initial visibility did not improve. The prior reentry label
was wrong: switchModule("home") returns without navigating; those samples reopen
the already selected presenter. They do not establish a home-reentry regression.
First-visible timing must not be conflated with all-font readiness. The former
full UI font transfer (~2.06 MB, present in all three WebKit before entries) was
absent from all after entries. Routed crossover and exact font coverage tests
independently support the fallback fix. No glyphs were removed.

Follow-up Chrome CPU profile: completed home rendering totals ~195 ms; entry
still has actual scripture-resolution/hydration updates. Reentry full render
~349 ms includes ~166 ms rectangle/layout reads. These remain optimization
candidates, not fixed or claimed eliminated here. Freshness-related scripture
updates remain enabled; no stale cache was introduced to improve measurements.

Public Chrome/WebKit checks passed: runtime-only boot and common output fonts,
actual full/element atomic-save functions with fake RPC, rollback and sibling/
inflight draft isolation, linked document save, 180-preview scrolling/fitting
(no clipping or mismatches; max gaps 131/91 ms), 32 lyric bounds cases per engine,
output swaps and late backgrounds preserving blackout. All production writes
were blocked; existing worship data was only read, and no test records were
created. Raw measurements/profiles stay in private /private/tmp/mindex-perf.

### Reentry/layout follow-up · 2026-10-17

Prior native scripts incorrectly called switchModule('home'), which deliberately
ignores home. The former reentry timings therefore measure same-view reopening,
not returning from home. The corrected script calls goHome() and asserts the
module before each return. Corrected pre-change medians (3 fresh profiles per
engine, release list-name-tooltips): Chrome first entry1.287s /home reentry.178s;
WebKit first entry.646s /home reentry.137s. Fonts-ready reentry.192/.186s.
The prior claim of a home-reentry regression is withdrawn.

Profile-backed changes move sidebar scroll reads before large board insertion
and remove synchronous rectangle reads at deferred-board mount. First/active
groups remain mounted; observer preloading, immediate fast-scroll hydration,
explicit jump hydration, data fetches and font metrics are unchanged.
Routed before/candidate crossover (two each/engine) was noisy: first-entry median
Chrome1.176/1.510s, WebKit1.599/1.382s; reentry.145/.132s and.141/.154s.
These are not native-cache/network-independent speedup claims. The deterministic
regression rejects original code (19 synchronous mount rectangle reads), passes
candidate (zero), and verifies immediate initial board plus fast bottom scrolling.

Local validation:13 unit +12 existing Cloud smoke entries, new deferred-board
smoke (now in default gate), retained DOM on incremental edits/inserts/deletes,
180-preview traversal with no clipping/mismatch (max gap30.5/41ms),32 lyric bounds
per engine and output swaps/blackout all pass. Public/CI verification follows.
No production worship data was modified. Private raw traces remain outside Git.

Published follow-up: Pages39032664038 succeeded for2c3de742,
release20261017-version-delete, retaining entry-layout plus concurrent surface,
audio and version-management changes.14 public file hashes match, including
runtime/source, CSS, manifest, timing/design modules and six common fonts.

Corrected native after medians (3 fresh profiles/engine, goHome asserted):
Chrome home1.063s /first board.697s /fonts ready1.147s /reentry board.154s /
reentry ready.179s. WebKit1.060s /.849s /2.039s /.188s /.223s respectively.
Corrected before first/reentry board: Chrome1.287/.178s, WebKit.646/.137s.
Chrome samples improved; WebKit did NOT show an end-to-end improvement in this
small live-network sample. Do not advertise a WebKit latency reduction based on
removed forced layout alone. WebKit after first-frame samples1.140/.849/.609s,
and before.646/.529/.975s overlap. First-entry network/asset wait still varies.

Public Chrome/WebKit passes: runtime-only boot, common output fonts, actual save
functions against fake RPC (rollback/linked aggregate/inflight draft isolation),
180 previews with0 clipping/mismatch and29.2/40ms maximum event-loop gap,
32 lyric-bound cases each and late-media swaps/blackout. No production writes,
test records, schema or permissions changes. Existing worships remain untouched.

Linux39032664241 passed the new mount/scroll regression, runtime/font tests and
atomic save checks, then failed the newly upstream children-audio replay fixture
on WebKit. Upstream0185df97 adds proper seekable WAV206 range responses plus
failure diagnostics without reducing assertions; latest Linux outcome must be
reported separately. This is not a claimed whole-CI pass yet.

Linux39033021838 still stalled after backward seek with route.fulfill even with
206 responses (play/seeking/seeked, readyState2, play promise pending). The fixture
now serves WAV ranges through the actual local HTTP server without intercepting
local requests; all external requests remain blocked. Same15s assertions and real
click/clock/slide/replay/stop checks remain. Both local engines pass; Linux retry
will distinguish media-fixture transport behavior from an app regression.

Final verification: merged upstream explicit audio-pipeline restart with native
HTTP media fixture in39dc32e7. Linux Cloud39033410319 succeeded (13 unit +14 smoke
entry points), including WebKit replay. Pages39033410534 succeeded; final release
20261017-audio-restart.14 public files exactly match local hashes. Public runtime
and common-font checks pass on both engines; WebKit output swaps and blackout
pass again. Local real-HTTP children replay, manual-lyrics timing and output tests
also pass. This supersedes the pending/failing CI status above. The timing table
remains a measurement of the preceding version-delete release containing the
same entry-layout change; no WebKit end-to-end speedup is claimed.


## Manual slide navigation keeps synchronized audio playing · 2026-10-17

Manual next/previous/first/last/jump and direct slide launch suspend automatic
lyric following without pausing or replacing the media pipeline. Invalid jumps
leave sync intact. The transient latch survives same-source pause/resume and
seek; explicit synchronized restart or a new source resets it. Persisted cues
and enabled flags remain unchanged. Output stop/window closure still stop the
sync-owned audio. Chromium/WebKit checks cover continued real audio progression,
no snap-back, seek/resume, restart, and existing ownership/save isolation.

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

## Independent photo timing preparation · 2026-10-18

The worship timing editor can attach ordered image files with absolute photo cue
seconds. The existing immutable media upload + atomic worship save owns the set;
Praise DB and children audio remain untouched. Projected photo continuation frames
hold the active lyric; pagesFor/fingerprint/editing recover the original lyric
pages and cues. Physical slide indices can expand. Invalid/stale profiles cannot
produce photo continuation frames. Manual navigation retains existing audio and
suspends auto-follow. Do not call prepared code deployed or final-photo playback
verified until those steps run with the user's actual assets.

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

## Browser fullscreen-close race · 2026-10-18

Isolated worktree change only: coalesce fullscreen entry and app close requests,
await native exit before closing, keep controller stop/audio policy unchanged.
Confirmed a Mac WebKit 2248 native fullscreen trap in an app-free reproduction.
Native-close smoke exits fullscreen explicitly; rapid app-stop smoke keeps real
fullscreen startup and checks three immediate stop/reopen cycles per engine.
Unit checks cover ordering, duplicate requests, denied entry and failed exit retry.
No Cadaros lyrics, timing, photos or production records were written.


## Department assignee linkage · 2026-10-18

Four calendar prayer fields now share atomic saves with children/youth/young-adult
worship elements. Teacher honorific is 교사. See worship-data-contract.md for
field scope, retry/conflict behavior and duplicate-service restrictions.
Production verification and deployment receipts are recorded separately.

## Praise/bulletin realtime · 2026-10-18

See `docs/content-realtime.md`. `mindex.content-live.js` handles saved-record
invalidations, with bulletin controller guards inside `mindex.bulletin.js`.
Do not replace these detached refresh paths with loadSongs/load(force): those
paths can replace drafts or rebuild Presenter data. Remote receipt must stay
read-only. Keep saved weekly bulletin snapshots independent of template changes.

## Calendar/list realtime · 2026-10-18

`docs/operations-realtime.md` extends department calendar invalidations to every
editable field. Non-linked edits use calendarOnly; merging linked notifications
must retain service invalidation. `mindex.service-list-live.js` handles membership
only, using complete fresh ID reads. Never use cached/partial reads to infer
remote deletions or loadWorshipData to refresh the list during editing.
