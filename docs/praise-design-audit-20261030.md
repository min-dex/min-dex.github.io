# Praise design audit ·2026-10-30

Baseline:1c8cc38a with the independent keyboard-test commit ee4a31bc.
Contracts: design-system.md and ui-contracts.md. Synthetic native Praise records;
no production writes, playback, ID migration, 2.0 activation or individual release.

## Confirmed defect and bounded correction

The version header renders four direct areas: title, actions, saved-audio summary,
and media disclosure. Its shared subgrid reserved only three rows. Both Chromium
and WebKit placed the audio summary and disclosure at the same top coordinate
(254.5px in the baseline desktop fixture), visibly overlapping their text.

With coordinator approval, only the Praise header's repeat count and row span in
styles.workspace.css change from3 to4. Shared version alignment remains; global
spacing/color tokens, desktop minimum width and output styles are unchanged.

## Screen inventory

| Area | Observation |
| --- | --- |
| Catalog | Selected row retains accent; long title truncates in list and wraps in editor |
| Metadata | Inputs35px,14px/600,10px horizontal inset; narrow popup fields remain within popup |
| Lyrics/form |16px text, dense30px tools, neutral panel/field surfaces; delete distinct from disabled move controls |
| Version header | Selected border/inset remains; fourth media row now separates from audio status |
| Media empty/error | Missing-score message and explicit audio-error text remain visible without overlapping summary |
| Themes | Real applyTheme path exercised for light and dark; not merely root data-attribute replacement |
|390px viewport | Desktop canvas horizontal scroll is intentional under ui-contracts.md minimum700px rule, not a defect to hide |
| Icons/labels | Rendered tools retain named actions; metadata fields also use enclosing labels, so absent aria-label alone is not a defect |

Existing media CSS uses4/6/8px gaps and native36px audio transport. These are
pre-existing deviations from the preferred5px rhythm/native transport geometry,
not silently normalized during this scoped bug fix. Current source metadata copy
still uses older version/output naming; reconcile with release ownership rather
than mixing unrelated copy changes into this candidate.

## Evidence and boundaries

`tests/smoke_praise_header_layout.py` covers Chromium/WebKit × light/dark ×
1280/390 × lyrics/media-expanded/metadata (24 configurations), long titles,
explicit synthetic audio-error feedback, ordered nonoverlapping header rectangles
and exact forms/audio/relations/service-items preservation. Screenshots and geometry
are under primary-checkout output/praise-design-audit-20261030, corrected images
under after/. Native audio is not played; no real asset is downloaded.

The source audit screenshots were visually inspected before/after. This is not
physical-device certification or a full accessibility/contrast certification.
Ordinary metadata keyboard behavior and retry preservation are separately covered
by the prior input audit. The coordinator owns required CI/publication and should
register the new layout regression in the combined gate; current frozen IME batch
must not be expanded for this later candidate.
