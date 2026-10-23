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
