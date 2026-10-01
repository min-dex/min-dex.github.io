# Lyrics Validation Runbook

Current practice, updated 2026-09-23. This is a Data review workflow, not a
runtime normalization rule. Read `HANDOFF.md` and `worship-data-contract.md`
before production repairs. A request to audit does not authorize rewriting lyrics.

## Read-only audit

1. Fetch current records with pagination. Check canonical songs, song versions,
   version units, and their worship references. Report the date and row counts;
   cached exports are evidence from that date, not current production state.
2. Run `python3 scripts/audit_mindex_content.py --json` for base reference and
   text checks. A clean result does **not** establish complete lyric correctness:
   this script does not cover all line-edge spaces, missing lyrics, spelling,
   or presenter song-form resolution.
3. Separately check empty versions and whitespace-only units. Distinguish no
   units from units containing only whitespace, and inventory actual worship
   references. Resolve input mode, visibility, manual lyrics, score output and
   applicable runtime fallback before calling a referenced empty version an
   output failure. A `filled` content state is not proof of usable lyric text.
4. Check replacement characters (`U+FFFD`), unexpected control/invisible
   characters, markup residue and input placeholders. Flag unusual characters
   for inspection; do not strip every non-Korean character.
5. Inspect each line's leading/trailing spaces and tabs, separately from Korean
   word spacing. Record version ID, unit ID, label, line number and a short
   excerpt with visible space boundaries. Count affected versions, units and
   lines separately.
6. Validate section types, labels and ordering against the current parser.
   Resolve the actual worship song-form tokens against the chosen version,
   including numbered verses, partial blocks and instrumental sections. Preserve
   intentional chorus repetition and blank-line boundaries used for slides.
7. Review spelling and Korean spacing against the correct score/edition or a
   user-confirmed correction. External lyric sites can also contain errors.
   Mark unverified wording as a candidate, not a confirmed defect.

## Interpretation rules

- Empty lyrics are not automatically data loss. Unfilled catalog versions,
  alternate language versions and hymn editions must be reported separately.
- Do not copy 새찬송가 lyrics into 통일찬송가 based on title similarity. Verify
  edition wording independently; preserve edition-specific words and endings.
  See `full-hymn-audit-2026-08-19.md` for historical evidence.
- Normalizing whitespace for comparison must not erase the distinction between
  wording, word-spacing and layout differences in the report.
- Leading/trailing ASCII spaces are different from spaces **inside** a sentence.
  For an approved edge-space cleanup, trim only spaces/tabs at each line edge;
  retain newline sequences, blank lines, punctuation, section labels and order.
- Existing song-title/number distinctions, performance markings and alternate
  versions require their own context; never infer a lyric correction from a
  title alone. Non-song catalog entries are cleanup candidates, not permission
  to delete records.

## Approved repair and verification

1. Re-fetch the exact target records immediately before mutation. Prepare a
   bounded list of IDs, old/new values and expected occurrence counts. Abort on
   unexpected counts or concurrent changes rather than broadening the patch.
2. For a confirmed typo, replace only the approved phrase in the approved
   version/units. For edge spaces, verify that all other text and line breaks
   remain identical. Do not globally collapse whitespace or run a general
   spelling rewrite.
3. Use the existing supported save path when possible. Direct Data-layer patches
   must preserve IDs/references and update the version's `lyric_signature` using
   current app ordering and signature semantics (`versionLyricSignature` in
   `app.js`). Check canonical/version signature collisions before writing.
4. Prefer atomic writes when supported. Otherwise guard each update with its
   previous value, track partial success, and reconcile failures before reporting
   completion. Never silently overwrite concurrent edits.
5. Re-read every changed unit and version from production. Verify exact text,
   signature, unchanged layout and targeted reference integrity. For changes
   affecting labels, blocks or song forms, verify actual presenter output too.
6. Record what was checked, changed and deferred. Data-only repairs do not imply
   an app deployment. Do not claim whole-catalog spelling verification after a
   structural scan or a few confirmed replacements.

## Confirmed examples from 2026-09-23

- `팡팡 나눠줘요`: user confirmed `나줘 주어요` → `나눠 주어요`;
  four exact occurrences corrected and re-read from production.
- Edge-space cleanup: 30 affected lines across eight units in seven versions;
  lyrics and line breaks preserved, signatures updated and re-read.
  Targets were `탕자처럼`, `승리는 내 것일세`, two `마라나타` versions,
  `나를 만나주세요`, `나의 왕 앞에서`, and `팡팡 나눠줘요`.
- That audit found 505 empty versions, including 402 with hymn numbers, and
  three empty versions directly referenced by worship elements. These are dated
  observations, not expected counts for future audits or proof of output failure.
- The whitespace-only Verse in `주님의 선하심` / `English` was reported, not
  deleted or populated as part of the typo/space repair.
