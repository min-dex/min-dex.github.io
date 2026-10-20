# Cloud development handoff · 2026-10-16

## Status

Repository preparation is separate from a published Codex Cloud environment.
The local baseline passes seven Node checks and four Python smoke entry points
(including Chromium/WebKit atomic-save, media retry and startup theme cases).
The same baseline passed on Ubuntu 24.04 in GitHub Actions run 38869180649
(7f2289a2). Environment publication and a real phone-initiated Cloud task are
not yet verified; browser account login is pending. The hourly Biblia monitor
was deleted at user request. Finish/reconcile local work before resuming setup.

## Environment

Use GitHub repository `min-dex/min-dex.github.io`, current `main`, private/Only me
environment. Install script: `bash cloud/setup.sh`. Requires Node 22+, Python 3.12,
venv and Linux browser dependencies. Setup downloads pinned Playwright/Pillow
and browsers; allow their package/download hosts. No Supabase credentials needed.
Run `.cache/cloud-venv/bin/python cloud/check.py` from the repository root.
Do not reuse a Mac virtualenv or copy node_modules into Linux.

The baseline deliberately names reviewed offline tests; never glob-run every
script. Some tests import local sources, need PostgreSQL or perform live writes.
Additional change-scoped checks remain mandatory. Physical mixer output,
macOS/Windows signing and original-source full-corpus comparisons are distinct
from this web gate. The desktop-release workflow retains platform build runners.

## Git and deployment

Work on a task branch, fetch latest main and inspect the diff before integration.
Use Cloud web checks in GitHub Actions as Linux verification. Integrate only after
required checks pass. Pages must use the GitHub Actions publishing source. The Cloud web checks
workflow deploys main only after its offline-web job succeeds; verify that run
and production bytes/version after a release.
Do not claim deployment merely from a successful push. Runtime changes must follow
the existing index.html fallback/mindex-release.json version convention.
No publishing credential belongs in setup scripts, public files or test output.
Cloud GitHub access/push permission and an end-to-end Pages release from Cloud
must be verified after account/environment setup, not assumed from local SSH.

## Preserved local work and materials

Before setup, main was 4515fe49; the isolated worktree incorporated remote
b4d09f3f (bulletin) and d4413696 (ASV). Their runtime changes were already on GitHub.
Remaining local app.js differences are whitespace; styles.css contains an extra
edition-info rule block. Other uncommitted records include audit reports,
SQL/official-client work and test expectation updates. They were not blindly
promoted to production or publicly uploaded.

Private local backup: `backups/cloud-migration-20261016/` in the original Mindex
checkout. `uncommitted.tar.gz` holds 84 changed/untracked files, `tracked.patch`
preserves tracked changes, and `manifest.json` records hashes. A separate
`materials-manifest.json` inventories 275 private material files (~557 MB),
including backup/source evidence. Credentials are excluded; Biblia is untouched.
These local snapshots are preservation, NOT remote backup or completed migration.
They must remain available until reviewed private storage/access is verified.

Public source identity/edition/hash receipts remain under docs/bible-*. Never
publish entire corpora, private SQL payloads, user data or credentials in this
public repository. For original-source revalidation, arrange private authorized
source access and validate against the recorded hashes before declaring parity.
Normal offline UI/code work does not need original corpus or production keys.
Do not delete local files or retire the Mac checkout until both code and necessary
private-material access have been independently verified from Cloud.

Official setup reference:
https://learn.chatgpt.com/docs/environments/cloud-environments


## Baseline extension · 2026-10-17

The default gate now includes8 Node checks and6 Python smoke entry points.
Added scripture-catalog overlap/readiness/error tests and actual browser
initial projection/lazy archive/version equivalence coverage. Integrated commit
cd0bd081 passes Ubuntu Cloud run39017082239; local checks pass too. This does not
change the separate Cloud environment publication or hardware verification status.


Baseline update ·2026-10-17: release861e07c8 adds the real-HTTP-cache UI font
regression alongside the concurrent unchanged-save unit guard. The default
gate is now9 Node checks +7 Python smoke entry points and passed Ubuntu run
39022426589. Full glyph/variable-outline verification is additionally available
as tests/test_ui_font_segments.py with fontTools4.60.2 and Brotli1.2.0; it is
separate from the default browser dependencies and passed11700 comparisons.


Startup read-pool update ·2026-10-17: default gate now10 Node +7 browser entry
points, including bounded read scheduling, late drafts, failure settlement and
retry. Local pass is separate from the next Linux Actions/deployment receipt.


Stalled-download recovery adds smoke_stalled_download_recovery.py to the default
Cloud gate:10 Node +8 browser entry points. Both request-winner races, current
release selection and late-response non-execution are covered. Production data
and credentials remain outside these offline checks.


Release0c02f90d passed Linux39025986389 (10+8). Subsequent integrated icon subset
9bb20f43 passed Linux39026352491 (11+8); both corresponding Pages releases were
verified separately. Stalled-download fixtures retain an unversioned vendor case
alongside the new versioned icon module. No production writes were tested.


Static delivery diagnosis is separate from the offline baseline. Run
`python tools/probe_static_delivery.py` explicitly to compare four fresh Chromium
profiles against public static files. It visits only favicon and fetches the
reviewed JS/CSS list as bytes, never evaluates app scripts or contacts Supabase.
The dedicated `Static delivery diagnostic` workflow runs manually or when its
own diagnostic files change on main, with read-only permissions and a seven-day
JSON artifact. It is not a scheduled monitor or a default setup/test dependency.
Network timings across runner/Mac locations are evidence, not identical-path
benchmarks; do not infer a specific ISP/CDN fault from a single fast remote run.

Compact runtime verification adds `test_app_runtime.cjs` (Node built-ins only)
and `smoke_presenter_font_cache.py` (real HTTP cache, both engines). With the
concurrent audio-bundle and startup-overlap checks the gate is now 12 Node + 11
smoke entry points. No minifier, font builder or production credential is needed
for default setup/tests. Optional regeneration and exact fontTools outline checks
are documented in `code-organization.md`.


## Test-gated Pages publication ·2026-10-17

Repository Settings → Pages → Source must be **GitHub Actions**, not Deploy from
a branch. This disables the independent automatic branch deployment path.
`cloud-check.yml` runs the reviewed offline baseline, then `deploy-pages` depends
on `offline-web` success in that same run and checks out the exact tested SHA.
PRs, codex/* branch pushes and non-main manual runs only test. Failed/cancelled tests never invoke Pages,
so the previously deployed site remains available. Setup failures also block
publication; never use continue-on-error or always() to bypass this gate.

Deployment is serialized without interrupting an active publication. A stale
run/re-run whose SHA no longer matches main is rejected before artifact upload.
The artifact comes from git archive HEAD, excluding untracked files, CI caches
and test modifications; no production DB access is involved. CI failures must
be fixed and rerun, not bypassed through branch-source publication.

This gate covers the explicitly listed offline baseline, not every possible
bug, production data integrity, physical output or signed desktop releases.
GitHub source-setting activation and the first gated Linux run must be verified
separately from local configuration tests.


## Bounded local checks and isolated CI shards ·2026-10-20

For bounded UI edits, run relevant local unit/browser checks; the complete GitHub
gate remains mandatory before Pages publication. Do not repeat the full local
baseline merely to duplicate that gate. Broader data/runtime risk still requires
corresponding scoped regression checks. CI-runner changes require local partition
and failure-propagation tests plus successful execution of all CI shards.

The offline-web matrix runs four isolated Ubuntu jobs, using zero-based
--shard-index and --shard-count 4. Unit/manual checks run once on shard 0; every
reviewed smoke appears exactly once across the four jobs. Each job retains its
own checkout, browser profiles and fixture outputs. No same-directory concurrent
smokes are introduced. fail-fast:false retains complete failure evidence; Pages
needs the whole matrix to succeed and retains the stale-commit guard.

The no-argument cloud/check.py command still executes the entire baseline.
Shard PASS is explicitly partial; per-entry timings support future balancing.
