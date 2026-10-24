# Citation Quick Insert

- The citation input exposes an `즉시 송출` checkbox, enabled by default.
- A dedicated live scripture composer appears once in the right controller panel, below the preview and immediately above worship order input, not on individual thumbnails. It uses a static, thin multicolor border, Enter submission and a header-aligned immediate-output checkbox. Board replacement preserves the focused input's draft and caret.
- The controller session retains the setting across board renders. Changing the checkbox never changes the current output.
- Enter captures the setting before asynchronous verse lookup. When enabled, successful lookup jumps to the first added verse and opens the output if needed. When disabled, it adds and saves without explicit selection, output opening, or scrolling.
- A browser window is reserved synchronously within the Enter gesture when output is closed. It navigates to the presenter only after lookup succeeds, and closes on lookup failure.
- Duplicate Enter requests for the same element are ignored while resolving. IME composition does not submit. Switching services while resolving prevents automatic navigation on completion.
- Tests: `smoke_citation_sidebar.py`, `smoke_citation_output_navigation.py` and `smoke_citation_toggle_layout.py`.
- Citation submission does not scroll the controller to the output slide. The right panel retains its own scroll position and input draft independently of the slide board. Explicit slide navigation retains its normal scrolling. Regression coverage: `smoke_citation_sidebar.py` (Chrome/WebKit).

## Shared scripture input contract ·2026-10-20

Worship reading titles, scripture bodies/citations, live scripture and song
scripture metadata share `inspectScriptureReferences` and
`validateScriptureReferences`. Korean/English aliases, chapter/verse notation,
ranges and contextual comma/semicolon lists use the existing Bible parser.
Canonical references use full Korean book names and an en dash for verse ranges.
Per-reference worship editions and explicit live edition selection are retained.

Unrecognized fragments remain in the draft. A mixed valid/invalid list is rejected
as a whole instead of silently dropping fragments. Before saving or live output,
resolve the selected edition and verify that requested range endpoints exist in
its chapter data (including combined-verse rows). Lookup failures block the
operation; current live output and typed text remain intact. Manual scripture
bodies are user text and bypass reference validation. Empty optional fields are
allowed. Validation never bulk-updates stored records.

Song reference fields show syntax errors inline. Service saves retain the atomic
save path and reject edits arriving during asynchronous reference verification.
Tests: `smoke_reference_validation.py`, `smoke_scripture_aliases.py`,
`smoke_citation_translation_editor.py`, `smoke_atomic_save_runtime.py`.

## Equal verse endpoints ·2026-10-24

The shared Bible reference parser collapses equal start/end verses to a single
verse (`삼하 2 4-4` → `사무엘하 2:4`). This applies to worship preparation,
reading/citation inputs, song references and live scripture. Non-equal ranges
and invalid/reversed-range rejection are unchanged. No stored records are
bulk rewritten. Covered by `smoke_reference_validation.py`.

## Context and numeric guards ·2026-10-24

Normalize NFKC before contextual list parsing. A bare number after a chapter-only
reference denotes another chapter; after a verse reference it denotes another
verse in that chapter. Special chapter labels reject explicit zero endpoints
instead of dropping them. Invalid fragments still invalidate the complete input.

## Live input feedback ·2026-10-24

Scripture address fields validate the current draft for field/wrapper colors and
accessible error text while typing, including after rerender. This is syntax
feedback only: presenter text/model/output stays committed until Enter. Existing
endpoint verification and atomic save remain unchanged. Version selection refreshes
form-field/header warnings immediately before persistence completes, without
changing form drafts or replacing focused controls.
