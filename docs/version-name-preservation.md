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
