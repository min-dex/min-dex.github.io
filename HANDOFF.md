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
