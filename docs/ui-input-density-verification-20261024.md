# Input density release verification · 2026-10-24

Includes Presenter input preferred widths, corporate-prayer wrapping, metadata
columns, reference fields, section editor and panel-width background controls.
No app logic, production records, schema or permissions are changed.

## Resolved test failures

- Scripture reading, Praise responsive and search layout: tests waited for function
  definitions but not boot settlement; ui-booting intentionally hides the shell.
  Wait for completed boot before constructing fixtures or using real clicks.
- Measure metadata: old stanza wording is now the slide measurement label
  `approx. 16 bars` / `approx. 17 bars`. Use normal editor route rather than the
  presenter output route. Read-only, stale, unknown, version identity, dirty flags,
  validation alignment and focus assertions remain active.
- Operational rhythm: toolbar help control uses35px;34px belongs to side-panel
  controls. Match the current toolbar contract, retaining real geometry checks.
- All fixture tests explicitly run offline to avoid credential/config reads.

## Local results

All passed in the isolated release candidate, Chromium and WebKit:
- smoke_measure_metadata_field.py
- smoke_scripture_reading_layout.py (both themes320/390/1440)
- smoke_praise_responsive.py (320/390/768/1024/1440)
- smoke_search_layout.py (real assertions and sidebar screenshot)
- smoke_operational_ui_rhythm.py (both themes1440/900/760/390/320)
- smoke_utility_input_density.py (metadata/reference both themes300–720;
  background300/420/600/720, no overlap/overflow and single row at720)
- smoke_individual_input_layout.py
- smoke_medley_input_alignment.py
- smoke_praise_input_layout.py

Earlier local checks also passed current Praise narrow/long-content and bulletin
print isolation. Current receipt supersedes the initial failure report.

Release queue, exact commit CI, Pages and public readback are recorded below when
completed. Local passing results alone do not claim publication.
