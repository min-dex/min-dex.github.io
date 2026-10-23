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
