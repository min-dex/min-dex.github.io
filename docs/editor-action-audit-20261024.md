# Editor action and disclosure audit ·2026-10-24

Offline actual renderers, Chromium/WebKit, no operational writes.

Findings and changes:
- Praise: six repeated plus icons across empty/add-form controls. Keep action
  labels, add behavior and targets; remove decorative plus icons.
- Bulletin: save/print/source-refresh icons mixed with text-only neighboring
  actions. Remove these three decorative icons; retain labels and handlers.
- Bulletin: monthly optional fields initially expanded in legacy/children designs
  while modern design starts closed. Start closed consistently; retain existing
  document-specific disclosure memory across content/layout rerenders.

Other reviewed surfaces:
- Praise narrow/long content and metadata dialogs pass at390/600/768/1024/1440,
  both themes. No additional state change needed.
- Operational background tools, toolbar help, floating section editor and unsaved
  dialog pass both themes at1440/900/760/390/320.
- Manuals: all29 navigation targets click/Enter, route/history preservation,
  heading focus/internal scrolling and source links pass at1440/640/390.

Verification:
- smoke_editor_action_consistency.py: baseline audit reproduced six Praise and
  three Bulletin icons plus expanded monthly fields. Revised candidate passes
  real add behavior and open/closed retention across modes, widths and themes.
- smoke_praise_narrow_content.py: PASS both engines/themes.
- smoke_operational_ui_rhythm.py: PASS both engines/themes.
- smoke_manuals_layout.py: PASS both engines.
- smoke_bulletin_shell_print.py: PASS both engines, two A4 landscape pages and
  print-shell isolation. Its fixture lacked styles.workspace.css after the split;
  add the actual production stylesheet, retaining the existing700px assertion.
- Runtime hashes, SOLID budget and diff whitespace checks pass.

Local verification is separate from the shared exact-SHA CI/Pages/public receipt.

First branch run40053280687 correctly blocked publication because removing icon
references changed the generated Lucide subset. Regenerate mindex.icons.js with
the pinned builder; test_ui_icons.cjs now passes its exact generation/SVG parity
checks. Revised exact SHA must pass all four required shards before publication.
