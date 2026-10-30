# Version Name Preservation

Decision: 2026-09-12.

Explicit praise version names are user data, not localization keys. Preserve
nonempty names (including Default, default and 버전 1) through editing,
display, serialization and reload. Trim surrounding whitespace only.

New default versions and empty editor values continue to use 기본. Do not
infer whether an existing name was generated from its spelling, or rewrite
existing database rows. Previously replaced names cannot be recovered by
this change alone.

Verification: tests/smoke_korean_default_version.py.

## Version deletion ·2026-10-17

Version headers expose a named delete button. Every removal requires confirmation
with song/version names and lyrics/form scope; cancellation changes nothing.
Removal stays in the Praise draft until the existing save action. Keep at least
one version. Preserve other versions and unsaved selected lyrics. Persisted
worship-element references block deletion, including a second check on save;
lookup errors fail closed. Only explicitly approved missing version IDs may be
deleted by saveSongVersions; unknown concurrent versions cause a conflict instead.
The existing multi-request Praise save is not atomic; no worship records/schema
are changed, and this client check does not replace a DB concurrency constraint.


## Optional version output title ·2026-10-19

Version name remains an identity label (English, arrangement, hymnal edition).
`output_title` is an independent optional display title for every Praise version.
Blank uses the representative song title; never infer from English, original_title,
or a hymnal version name. Presenter title slides and element titles resolve the
selected version's output_title first. Existing hymn number decoration remains
unchanged pending its separate design task. The list retains the representative
title; version output titles are included in Praise search.

Persist explicit titles in the existing source-song memo as `versionOutputTitles`,
keyed by stable version ID, even when relational versions are enabled. Memo-only
versions also retain output_title. Relational attachment restores titles by ID.
Lazy metadata saves preserve unloaded entries; full version deletion removes
obsolete entries. This avoids a production schema migration and does not overload
subtitle/original_title. Existing memo compare-and-swap guards remain in use.
Title-only edits dirty song metadata, not lyric units or version-table rows.
No existing titles are auto-filled. Existing deployments that predate this memo
field must be refreshed before editing these songs, as their serializer does not
know the new field.

Validation: smoke_version_output_title.py checks both engines, metadata save with
mocked persistence, fresh row hydration, memo-only storage, clear/fallback, lazy
retention, separate version labels, and unchanged lyric text. Local verification
is separate from deployment and live persistence verification.

Local verification completed: 28 unit + 41 smoke entry points passed, including
both-engine version output title checks. UI icon subset regenerated from current
sources with prior asset retained privately. Production writes and deployment
were not performed in this task.

## Display order ·2026-10-23

Version headers provide forward/back controls. A move updates the local draft
and reuses the song's existing order slots; the normal Praise save persists it.
Selection and unsaved lyrics remain attached to their stable version IDs.
Display position never promotes a version to primary. Legacy records with no
primary still receive the existing normalization fallback. No worship references,
forms, playback or projection are changed by a move. Boundary buttons are disabled;
keyboard focus follows the moved card. Memo-only versions retain array order.


## Legacy raw-name fallback removal ·2026-10-23

Unnamed versions no longer derive a display name from raw_section_name, trailing
parentheses, or a raw title match. The stored version_label remains an explicit
label fallback; a missing label displays 기본. Normal relational hydration still
uses curated_version_name or version_label. Hymnal edition display and raw source
evidence remain intact. Parenthetical metadata display is separate and unchanged.
Read-only production inventory: 1,732 versions all have a nonempty stored name;
no current effective name ends in parentheses. 48 raw source names do, and none
depend on the removed unnamed-version path. No production records are rewritten.


## Raw parenthetical subtitle display ·2026-10-23

List metadata no longer infers a subtitle from parentheses in a version
raw_section_name/version_label. Existing song subtitle/original_title and explicit
version names remain authoritative. Raw source names, bracketed original-title
evidence, search indexing, textual version aliases and stable worship-version ID
links remain unchanged. No song/version/worship data is rewritten.

The read-only 48-version/42-song audit found 33 parenthetical values already stored
as subtitle/original-title data, 13 as explicit version names, and two representative
titles redundantly added to list metadata. Only those two redundant list strings
change. A whole-catalog comparison protects unrelated bracketed original titles.
The user-edited 주님의 임재 앞에서 is outside this display cleanup.

## Version-specific title label · 2026-10-23

The optional output-title input is labeled `버전 전용 제목` in its placeholder,
accessible name and search metadata. Empty values still use the song title; no
stored title/version fields or fallback behavior change.

## Version-owned audio summary ·2026-10-23

Version headers show the saved audio name, recorded timing count and saved auto-advance setting from that version's `audio_set`. A changed lyric source signature shows a timing-review notice. This is read-only saved metadata, not confirmation of current playback readiness. No song-memo fallback, service timing inheritance, data repair or writes occur. Empty audio sets show no row; long names wrap at the available card width.

Isolated Chromium/WebKit checks cover 320/800px, escaped names, empty/disabled timing, draft mismatch and no mutation. Special-service taxonomy was checked through a read-only ID query: the operational `special` row exists, so no client-side taxonomy upsert was restored. The local fullscreen-skip and hidden-element blank assertions are included separately; Linux native integration remains distinct from the macOS SKIP.

Lyric/type/variant input refreshes only the matching version summary status text in the existing header. It never rerenders the editor, replaces its input node, moves focus/caret, mutates audio metadata or updates another version's header. Returning to the saved lyric signature clears the notice. Isolated actual input/selection checks cover both browser engines.

## Single-record version navigation · 2026-10-25

Same-song arrangements remain independent saved records and existing worship
references stay unchanged. The editor offers a version selector for the current
same-song group, using the ordinary unsaved-change confirmation on navigation.
Cancelling restores the selector and retains the draft. Relationship management
is available in metadata editing, not the normal description. Duplicate display
names receive a temporary position suffix without changing saved names. Lyrics
preview headers use the full label Lyrics; song-form token L stays unchanged.

## Song-level catalog navigation · 2026-10-28 candidate

Confirmed native same_song edges form read-only display groups. Lists, global
search and worship song search show one row per group; matching variant titles
and lyrics remain searchable. No title-based inference or DB record merge occurs.
The representative is deterministic (new hymnal first, then native ID); selecting
another member keeps the common catalog heading and exact member identity.
Existing worship links, record titles, version names, forms, audio and cues are
unchanged. Search opens the matched member. Filters include a group when any
member matches. An explicit worship choice selects the exact eligible variant;
opening a group never writes a default variant. One-member groups have no version
selector. Native lyrics display only the selected member; names and optional
output titles remain editable in song information, with differing titles visible.
Legacy multi-version records retain their existing editing and persistence path.
Required release/public verification is separate from scoped local checks.

## Explicit variant identity and output title ·2026-10-29 candidate

Native song information always exposes `판본 구분명` independently from
`송출 제목`, including a single default variant. The group representative title
is shown separately. An output preview uses the actual presenter title resolver
and updates text only while typing, retaining the input node and draft.
Blank output titles keep the existing selected record's song-title fallback;
they do not adopt another variant's representative title. Hymnal numbering uses
the selected variant's existing rule. No strings are parsed into labels/titles,
no existing names are inferred or rewritten, and no DB migration is involved.
Existing explicit edits and native serialization remain the sole save path.
Lyrics, audio, cue timing, same-song relations and worship links are unchanged.
Local verification and shared publication remain separate checkpoints.


## Derived Verse/Chorus first-line search ·2026-10-30 candidate

Search derives an alias from the first meaningful nonempty line of every Verse
and Chorus in the loaded selectable record's forms. Display tags, standalone V/C
markers and inline verse numbers are removed from this derived text only. No
subtitle, title, form, lyric, audio, timing, relationship or worship row is rewritten.
Native version-specific forms stay with their original record identity. Title
matches take precedence; song grouping uses confirmed relations, never lyric equality.

Global/catalog and picker summary search use the existing spacing, punctuation,
Hangul-initial and token matching rules. First-line fields carry weight95 (title120,
full lyrics24) and the label 첫 소절; later lines remain full-lyric search only.
Fields share the existing per-song search cache and normal invalidation. Resolution
reads current forms so a cached old alias cannot authorize creation. The creation
boundary awaits catalogue loading before matching and blocks incomplete loads.

Only an exact normalized first line belonging to one confirmed song group may
resolve automatically. Partial/initial-only or cross-song ambiguous first lines
remain picker suggestions and cannot create an empty duplicate. Audio-only choices
use their eligible versions; an unavailable audio variant is not replaced by a
text-only one. Legacy multi-version matches require explicit selection. New input
links the selected existing native ID, not a new alias-titled record. Catalog headings
retain the representative main title; the selected version's output-title contract
is unchanged. No old services are normalized or resaved.

`smoke_praise_first_line_input.py` covers isolated Chromium/WebKit real input,
cold native catalogue load, exact/partial/ambiguous/title priority, marker/multilingual
and empty forms, global/summary/full-lyric ranking, actual picker candidates/click,
native atomic save failure/retry/rehydration and exact source/form/timing preservation.
Only repository/atomic RPC boundaries use synthetic fixtures. Publication remains
pending the coordinated complete gate, Pages and public verification.


## Native picker labels ·2026-10-30 candidate

Native selectors display the explicit saved variant name even when version_label
mirrors it; that equality no longer hides 별도 가사 as 기본. Standard native hymnal
labels display 새찬송가 / 통일찬송가 only. Hymn numbers and per-variant song
titles remain separate information, not suffixes of the variant name.
Imported redundant titles disappear from the selector only. Custom labels such
as 영어 remain explicit. Metadata edit values, raw evidence, record titles, output
titles, lyrics/media/timing and worship identities are unchanged. Legacy version
naming remains under its existing rules. The first-line browser regression also
asserts compact labels, custom-name retention and zero stored-object mutation.


## Single-variant controller spacing ·2026-10-30 follow-up

When the native version picker and score warning are both absent, its linked
wrapper is hidden too. Previously the empty flex item still occupied space
between the controller song title and form. The DOM replacement target remains
for subsequent search/variant changes; loading failures, score warnings and
multi-variant controls stay visible. No song, form, media, timing or service data
changes. The actual controller regression fails on the old nonempty layout box
and verifies no client rectangle after repair in Chromium and WebKit.
