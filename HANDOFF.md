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

## Common settings/reference realtime · 2026-10-18

`docs/content-realtime.md` extends the shared transport to saved service type
settings and reference links. Detached reads preserve drafts, open documents,
playback and scroll. No schema changes or automatic worship rewrites.

## Service summaries and archive realtime · 2026-10-18

See docs/operations-realtime.md. List summaries refresh without replacing open
editors or full documents; archive cards use revision scans and changed-only
reads, retaining leader drafts and rejecting mid-read saves.

## Saved scripture realtime · 2026-10-18

Successful scripture saves notify the existing content transport. Visible excerpt
catalogue reconciliation preserves drafts, reader/search DOM, chapter selection,
playback and deleted selected records. No schema/corpus changes. Contract and
change-scoped browser coverage: docs/content-realtime.md, smoke_scripture_live.py.


## Realtime scheduling latency · 2026-10-19

Shared scheduler coalesces at80ms and advances deferred reads after focus/media/
dialog exit, retaining all guards and15s failure backoff. No faster recovery polling.
See docs/content-realtime.md and tests/test_live_refresh_scheduler.cjs.


## Server-authoritative application state · 2026-10-19

Code and isolated tests completed on `codex/children-version-audio` (base d8dbb09d).
Draft/recovery/preferences/background registry/journals/legacy audio now use confirmed
server state; browser persistence remains only for connection identity. Immutable
uploads survive metadata-save retry; per-key mutations replay before reading the
latest manifest/history so concurrent additions are preserved. Existing worship
atomic writes stay the only instance-save path. Explicit editor recovery checks
baseline and current drafts; bulletin replacement awaits recovery and checks late
input. Output actions use one transport to avoid duplicate slide advancement.

Baseline 32 Node +45 browser entry points passed. Added audio persistence unit and
bulletin recovery/output IPC smokes passed; current gate is33+47. Post-followup
storage/audio/runtime/icon/atomic/editor checks passed. Atomic lifecycle passed
Chromium/WebKit separately; real PostgreSQL17.6 verified ACL and retry/conflicts.

User initially reserved Safari, then explicitly allowed it again. Mindex production
schema migration applied via Safari SQL Editor and independently read back: RLS on,
anon/authenticated direct table reads off, scoped read/write RPC execution on,
state table0rows. No browser data migration or app deployment yet. Deployment still
needs latest-main reconciliation and release/CI/public-byte verification. Worktree
changes are uncommitted; unrelated AGENTS/fullscreen smoke edits were preserved.
See server-state-current.md and server-state-verification-20261019.json.


### Server-state actual migration follow-up ·2026-10-19

Safari actual session state7entries/549bytes migrated with exact server readback;
originals retained, legacy audio0. Differing existing server values now preserve
the browser alternative in a private device archive without overwrite. Main
564c5981 integrated, local36+48 gate and scoped followups pass. Release target
20261019-server-state. Final Linux/Pages and Chrome initialization are pending;
see docs/server-state-verification-20261019.json for the completion receipt.


### Server-state deployment completed ·2026-10-19

Final main0d88bec8/release20261019-source-metadata-guard includes this migration.
Linux36+49 and Pages run39195317576 success;24 public assets match exact source.
Safari7 session entries migrated/read back before Mac lock. Existing Chrome
migrated38 entries and1 legacy audio profile; next reload restores server values
with0 new migrations/38 retained,1 audio profile, no read error/pending/dirty edit.
Originals remain. Unopened devices migrate on their next app visit. After user
unlock, Safari post-deploy reload also passed: ready,0 new/7 retained,0 archive,
0 audio profiles, no audio read error or pending save; actual home UI restored.
Audio physical playback and independent remote audio digest comparison are not
claimed. Completion receipt:
docs/server-state-verification-20261019.json. Unrelated AGENTS/fullscreen edits
remain untouched. This completion record is maintained on the task branch.


## Bible source review classification · 2026-10-20

The edition disclosure identifies retained provider text as the reading baseline.
Cross-edition wording and unconfirmed impression identity are not corpus errors
or required corrections. Source/edition history and actual source-conformance
repair evidence remain separate. No Bible body, production DB, service or record
changes. Rebuild/version the runtime for the approved web release.

## Children audio completion and presenter ideas · 2026-10-20

Current scope is `docs/children-audio-status.md`. Device-independent remote control
and a switchable focused presenter view are ideas only in `docs/presenter-control-ideas.md`.
Bible page numbers and whole-service PNG export are excluded. Retired the unused
folder import adapter and its dedicated test; existing version/occurrence audio
and source evidence remain intact. Downloads originals are outside this cleanup.


## Static shell icons and announcement labels · 2026-10-20

- Hydrate static app-shell icons once at normal init, before initial module render;
  empty/restored modules no longer rely on an unrelated global icon refresh.
- Announcement disclosure/field labels: 상하단 문구 / 상단 / 하단 (aria labels too).
- Scoped Chromium/WebKit initial/reload checks pass for Scripture/Praise/Service.
  Compiled release screenshots and isolated announcement fields verified in both.
- No production records, music, presenter output or bulletin printing changed.


## Quiet persistence and shorter checks ·2026-10-20

- Background storage no longer shows routine pending banners. Error/retry and
  pending beforeunload protections remain; RPC/queues/data semantics unchanged.
- offline-web now has four isolated runner shards; unit/manual checks once on
  shard0, every smoke once, all matrix jobs must pass before Pages. No bypass.
- Local bounded UI validation is change-scoped; full CI is required. Runner
  partition/failure tests plus Chromium/WebKit storage/retry checks pass locally.
- No operating data, active playback, presenter output or printing changed.


## Quiet Bible provenance ·2026-10-20

Move the closed source/edition disclosure below chapter text. Opening it shows
source, edition history, acquisition date and links; review/printing caveats stay
in a second closed disclosure. Existing source records and classification policy
are retained. No scripture bodies, DB, worship records or output changes.


## Discoverable Bible source disclosure ·2026-10-20

Place the closed 출처·판본 disclosure immediately below chapter/copy controls,
before scripture. Its basic source information and nested review/printing notes
remain closed until requested. Supersedes the prior bottom-of-chapter placement;
no corpus, metadata, DB, worship records or output changes.
## Focused presenter layout · 2026-10-20 local

Added optional 집중 보기 / 기본 보기 with shared previews, existing board and music actions.
Editor DOM survives layout toggles; view choice is transient, no new persistence.
Offline Chromium/WebKit checks preserve drafts, audio identity/time, and cover live/blank/end states.
New gate entry: tests/smoke_presenter_focus_view.py. Not deployed; no physical output verification.

Release verification also covers keyboard focus in both layouts and deferred board scrolling.
The old keyboard fixture now waits for ui-booting to finish; the same premature-start
failure was reproduced against unmodified bb5a1673. Existing assertions were retained.

## 저장·복구 후속 수정 ·2026-10-20

말씀/참고자료/찬양 저장 응답 중 새 입력 보존, 찬양 고정 snapshot 및 memo CAS
기준 갱신, 원문 이력/복구 전 양쪽 private archive, 실제 state 충돌 비교·선택,
revision이 바뀐 주보 이어쓰기의 명시적 복구를 구현했다. atomic journal은 서버
요청 확인만 허용하고 기존 예배 receipt/충돌 경로를 유지한다. 네트워크 응답
유실의 동일 요청 재시도와 운영 저장 경로는 유지한다.

로컬 Cloud 4묶음111entrypoints PASS(103/160/172/188초). Chromium/WebKit
충돌 비교·양쪽 보관·보관 실패 후 재시도, 주보 late input/보관 실패/새 revision
복구 PASS. 추가 찬양 편집 light/dark·1440/390 8조합 PASS. 실제 저장 함수
지연 응답 및 원문 취소/보관 실패/추가입력 검증 PASS. native macOS fullscreen은
기본 보호·SKIP 범위이며 실제 장비/재생/송출/운영 DB 쓰기는 실행하지 않았다.
release20261020-save-retry-preserve. GitHub/Pages 결과는 이후 별도 확인한다.

## 운영 저장 journal 차단 원인 수정 ·2026-10-21

작업공간 /tmp/mindex-server-journal-key. 기존 실제 SQL의 `supabase` 단어 차단이
project URL을 포함한 atomic journal/creation 키도 거절하는 오류 재현 및 수정.
새 migration은 설치된 함수의 해당 조건만 교체하며 권한/내용/요청 ID 유지.
PostgreSQL18.4 실제 store 연동 재현·동일 요청 복구, server-state/bridge unit PASS.
사용자 명시 승인 후 운영 함수에 적용 완료. anon synthetic write/replay/cleanup/
creation/secret-guard 검증은 전체 rollback; readback3항목 true.
운영 원본/초안 삭제 없음, 실제 사용자 예배 저장·재생/송출/인쇄 실행 없음.
증거 /tmp/mindex-server-journal-verified.png. 정적 앱 변경/새로고침 필요 없음.

## 교회력·주보 정상 private 저장 요청 보완 ·2026-10-21

작업 /tmp/mindex-server-journal-key. department.pending.v1, bulletin.v1/template의
project hostname만 secret guard에서 식별자로 인식; 나머지 키 검사는 유지.
PostgreSQL18.4 실제 실패 요청5개 재시도/기존 row 보존/권한/secret 차단 PASS.
사용자 승인 후 운영 migration 적용 성공. 별도 anon synthetic 저장·재시도·정리·
secret 거부 전체 rollback, 독립 readback3개 true. 운영 데이터/임시본 변경 없음.
재생/송출/주보 인쇄 실행 또는 코드 변경 없음. 정적 앱 재배포 불필요.
증거 /tmp/mindex-department-bulletin-server-verified.png.

## 안전 마무리·제어판 시각 정리 ·2026-10-21

사용자 제어판 정리 요청에 따라 예배 오른쪽 패널의 이전/다음 버튼 기본 테두리와
표면을 표시하고 부모 줄 높이를 기존35px token으로 정렬. 동작 코드 변경 없음.
Chromium/WebKit254/320/390px6조합 PASS; runtime hash PASS.
실제 사용자 창·운영 데이터·재생·송출·인쇄 조작 없음.
release20261021-controller-navigation, 별도 CI/배포 결과 확인 필요.


2026-10-22 numeric remote pairing: Production SQL applied successfully through Safari with one-time user authorization. Client release pending. Migration is isolated ephemeral schema/RPC, no worship mutations. Local PostgreSQL 18.4 test passes. Default pairing test added; SQL opt-in harness uses temporary embedded-postgres only. Existing deployed v2 stays usable.


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


## 2026-10-23 독립 아멘 유형 통일 / 묶음 적용 대기

독립 아멘14판본(새640–645, 통551–558)은 Lyrics로 통일한다. 이미 Lyrics인11판본은 그대로, 통551·553·556의 curated_unit_type/curated_unit_label 두 필드만 Coda→Lyrics 후보로 준비했다. 가사·줄바꿈·아멘 횟수·원본 source 필드·ID·순서 변경 없음. 일반 찬송가 끝의 Coda589단위는 그대로다.

유형 변경 단독 및 앞선 슬라이드 분량 후보와 합친 경우 모두 Chromium/WebKit 전체1203판본·기존 예배 참조350개 출력 보존 PASS. 세 변경판본의 기본/Coda/Coda-Coda/Coda-Coda-Coda12경우에서 아멘 횟수·슬라이드·경고 동일. 후보5419단위 metadata 종류/해시 일치. 운영 쓰기0, 실제 예배 변경0, 배포 없음.

최신 묶음 후보443판본·1626단위는 backups/20261023-independent-amen/{bundle-plan,bundle-expected,bundle-candidate-ledger}.json. 최신 읽기 결과에 이전 후보를 CAS 대조하여 반영했으며 별도 예배 변경은 보존했다. 이전 slide-final 후보만 단독 적용하지 말 것. 공개 대장/runtime은 실제 DB 적용·readback 때 함께 갱신한다. Main push/Pages 게시 대기 조율도 준수한다.

증빙: docs/independent-amen-types-staged-20261023.json.


## 2026-10-23 찬송가 비교 카드의 마디 문구 제거 / 미배포

사용자 요청으로 버전 비교 카드 아래의 renderVersionMusicalStructure 호출을 제거했다. 마디: 미확인뿐 아니라 같은 위치의 마디 상태 줄 전체를 제거하며, 메타데이터 편집창의 전용 마디 수 항목과 검토 자료는 유지한다. 새574/통303, 새109/통109, 새241/통232를 최신 묶음 후보로 메모리에서 열어 실제 가사 비교 UI를 캡처했다. Chromium/WebKit 모두 카드 아래 마디 문구 없음과 메타데이터 전용 필드 유지 확인. 가사/운영 DB/실제 예배 쓰기 없음. runtime 재생성, 배포 대기 유지. 개인 캡처: backups/20261023-hymn-comparison-examples/.


## 2026-10-23 고요한 밤 및 전곡 악구 줄바꿈 재검토 / 미적용

이전의 글자 수 중심 줄바꿈과 한 줄 병합 후보를 재검토했다. 새/통109의 본절은 동일 악구 두 줄을 복원하고 구주/왕의 판본 차이와 반복은 유지했다. 전체1203판본·연결481곡군에서 원래 구절 경계, 같은 가사, 대응 절의 음절/단어 경계를 대조했다. 자동 비교만으로 근거가 안 잡힌35구절군을 따로 읽고 어구 중간 절단과 괄호 응답 분리를 고쳤다. 정밀 악보 전수 재대조를 새로 완료했다는 뜻은 아니다.

이전 후보 대비333판본·1184단위 줄 배치 변경. 최신 묶음445판본·1643단위이며 독립 아멘 유형 변경3단위도 포함한다. 통27의2–4절과 통343의4절은 동일한 반복 악구가 다른 슬라이드에 걸쳐 있어4단위의 페이지 사이 구절 경계도 조정했다. 슬라이드 장수, 가사 단어/어절, 반복·아멘 횟수, 송폼 단위/순서, 곡 연결, 메들리, 음원 타이밍, 예배 테이블은 보존한다.

최종 같은 구절 줄바꿈 불일치0, 절별 대응 페이지 한/두 줄 불일치0, 같은 가사의 새/통일 슬라이드 경계 불일치0. Chromium/WebKit 전체1203판본 및 기존 예배 참조350개의 출력 문구/순서 보존과3해상도 넘침0 확인. 고요한 밤·하나님의 크신 사랑·하나님의 나팔 소리의 실제 비교 UI도 로컬 후보로 캡처했다. 운영 쓰기0, 배포 없음.

최신 적용 후보는 backups/20261023-hymn-line-review/{plan,expected,candidate-ledger}.json. 이전 independent-amen 폴더 후보는 이 기록으로 대체한다. 공개 대장/runtime은 운영 적용/readback 전까지 그대로 유지한다. 배포 조율의 main push 대기는 해제됐지만 이번 턴에는 push/배포하지 않았다. 증빙: docs/hymn-line-consistency-staged-20261023.json.

## 2026-10-23 찬양 동시 편집·저장 중단 보완 후보 (미배포)

`docs/content-realtime.md`의 찬양 편집 원자 저장 후보 참조.
기존 곡 저장의 부분 반영/동시 덮어쓰기 위험을 재현하고 앱+additive SQL 후보 작성.
임시 PostgreSQL18.4 동시 연결/취소/RLS rollback 및 Chromium/WebKit 검증.
운영 DB 쓰기0. **서버 함수 적용/운영 호환성 확인 전 앱 배포 금지.**
신규 곡 생성/빈 곡 삭제 경로는 별도 범위이며 구버전 앱의 직접 쓰기는 그대로다.
작업 폴더: `/Users/parkjihun/.codex/worktrees/presenter-focus-release/Mindex`.
## 2026-10-23 미래 예배 목록·컨트롤러 표시 일치

`codex/future-outline-consistency`: 빈 설교 제목에 담당자를 제목 괄호로 표시하던 controller fallback 제거. 단일 편집 항목의 목록·컨트롤러는 공통 read-only summary를 사용하고, 제목/담당자 일부가 있어도 필요한 입력이 비었으면 같은 안내를 유지한다. 기존 제목 칸에 담당자가 있는 경우 편집 모델의 title override를 존중한다.14개 예배 유형138개 기본 편집 항목과 부분 입력, 좁은/넓은 화면·포커스, 항목/출력 불변 확인. 운영 쓰기 없음. 배포 완료 여부는 GitHub exact-SHA gate/Pages와 공개 버전 확인으로 판정한다.

## 2026-10-23 송폼별 컨트롤러 묶음 색

`codex/form-group-colors`: 순서별 색 순환을 Verse 적색/Pre-Chorus 녹색/Chorus 청색/Bridge 청록/Coda 자홍/Tag·Tags 황색으로 교체. 성경은 요소·섹션을 넘어 밝은/어두운 회색 교대. Title·간주는 박스 없음 유지, 미분류 가사는 중립 회색. 반복·절·A/B 박스 경계와 기존 클릭·송출 순서 보존. Chromium/WebKit 양 테마·3폭 실제 렌더와 미래 예배14유형138항목 표시 회귀 확인. 운영 쓰기 없음.


## 2026-10-23 찬양 원자 저장 서버 적용

사용자 승인으로 get_praise_snapshot_v1/save_praise_v1 및 공유 잠금 트리거 적용.
기존 RLS/테이블 권한 유지, SECURITY INVOKER. 6개 테이블 적용 전후 행 해시 동일:
곡1142, 버전1731, 가사6751, 관계6, canonical1163, 예배요소2495.
실제 anon/authenticated 저장·동일 요청 replay·CAS 거절·음원 보존 검사 통과,
검증 변경 전체 rollback 후 동일성 확인. 서버 적용 전 금지 조건은 해소됐다.
앱 출시는 별도 GitHub 전체 gate/Pages/public readback으로 확인한다.

## 2026-10-23 Praise lifecycle candidate (not installed/published)

Existing-song atomic save d2487d0f was deployed and verified (branch gate
39942492912, Pages39943239476, five exact public files). New request extends
protection to sidebar creation, service-item/source-input creation and empty-song
deletion. See docs/content-realtime.md and migrations/2026-10-23-praise-lifecycle.sql.

Prepared two SECURITY INVOKER RPCs and a body-free immutable request receipt table.
Actual PostgreSQL18.4: concurrent duplicate title reuse, failed create/delete full
rollback, no resurrection after deletion, stale/lyrics/audio/metadata/FK protection,
shared-role execution and receipt DELETE rejection PASS. Actual Chromium/WebKit:
double click, lost create/delete replies, late service title changes, sibling edits/
reordering, unsaved form protection and linked deletion refusal PASS. Existing
Praise save browser suite, unlinked creation and input-module contracts, runtime
hashes and four cloud runner partition tests PASS.

Production installation pending user's answer allowing Safari for this new scope.
Do not publish this candidate before both RPCs are installed/verified. No production
song/worship writes performed for this candidate. No release queue ticket held.
