# Praise input audit ·2026-10-30

Scope: offline native Praise title/version label/output title, lyrics/form draft
preservation, variant navigation, persistence retries and search. Production
writes, playback, ID migration and release gates were not run here.

## Reproduced defect and ownership

On base `1c8cc38a`, the real metadata inputs send IME-confirmation Enter to
`handleDetailKeydown`'s Praise save branch. Both `isComposing=true` and legacy
keyCode229 call saveAll and cancel the event before composition finishes.
Chromium and WebKit each reproduce all six title/variant/output-title cases.

The release coordinator assigned the common handler guard to the Remote owner.
This candidate deliberately contains no app.js change. Its new regression test
must be combined with that guard; it is expected to fail on the unpatched base.
An isolated temporary branch guard passed both engines and was then removed.
The coordinator must rerun on the exact combined candidate and register
`smoke_praise_input_keyboard.py` in the required gate before publication.

## Verification inventory

| Surface | Evidence | Result |
| --- | --- | --- |
| Title, variant label, output title | New actual-DOM keyboard test | Baseline FAIL; temporary guard PASS in both engines |
| Normal Enter, Escape, Tab | Same test | Enter saves once; Escape/Tab do not submit |
| Focus/caret and mobile-width draft | Same test, 390px viewport and actual Tab | Both engines PASS; not physical mobile certification |
| Lyrics, forms, audio/cues, relations, service items | Exact protected fixture comparison | Both engines PASS |
| Variant switching and dirty navigation cancellation | smoke_praise_groups.py | Both engines PASS |
| Save response loss, retry and later edit preservation | smoke_single_song.py | Both engines PASS |
| Praise search, aliases, IME, stale query | smoke_global_search_regressions.py | Existing Chromium suite PASS, 40 search cases |

The keyboard test intercepts saveAll to count unintended submissions and never
commits data. Separate existing persistence fixtures cover failure/retry behavior.
Tests use synthetic records and block Supabase requests. No blanket claim is made
about every metadata control, actual OS IME, physical devices or live saving.
