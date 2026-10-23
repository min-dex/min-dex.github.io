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

### Measured balancing and superseded checks ·2026-10-23

The four shards now assign longer smokes first to the least-loaded shard using
`cloud/smoke_timings.json`, measured in run39888011911. This file schedules tests;
it never selects coverage. New allowlisted tests receive a10-second estimate and
still run exactly once. Unit/manual checks remain on shard0; no-argument order
and all timeouts/failure propagation remain unchanged. The measured smoke loads
previously ranged from173 to295 seconds including unit work.

Check-job concurrency cancels superseded runs only for the same event/ref/shard.
Pages keeps its separate non-cancelling publication group and complete gate.
Fetch/reconcile main before the branch gate; when main has not advanced, integrate
the verified SHA without a new merge commit so exact-commit reuse avoids running
the same suite twice. If main advances, reconcile and verify the resulting SHA.


## Exact-commit gate reuse ·2026-10-23

A main push can reuse a completed successful codex/** push of the exact same
SHA, same repository and cloud-check.yml workflow. All four offline-web jobs
must be completed/success in the successful run attempt, exactly once each.
Each main matrix job independently verifies that evidence and links the source
run in its summary before skipping repeated setup/tests. No code-diff heuristic
or partial-shard result is accepted. Missing/API/malformed evidence falls back
to full checks; PRs, branch pushes and manual dispatch always execute checks.
Read-only Actions permission is limited to the check job. Pages still depends
on all four successful jobs, checks main freshness, and stages the exact SHA.
The source branch gate remains mandatory before integration; a merge producing
a different SHA must run the full gate. Local partition/failure and evidence
validation tests are distinct from Linux/Pages verification.

## CSS-only affected-screen gate ·2026-10-23

`scope` computes one immutable plan for the four required offline-web jobs.
Modified known stylesheets use the union of their screen smokes, plus release,
icon, remote-theme, bulletin and gate-policy consistency checks. Shared
`styles.css` still selects every UI smoke; dedicated output/bulletin/calendar/
monitor/remote CSS selects the corresponding screens. The allowlist is in
`cloud/check_scope.py`. No-argument local checks still run the complete baseline.

A CSS candidate may include docs/*.md and version-only index.html,
mindex-release.json/app.runtime.json edits. Index markup/scripts, runtime hashes,
JS, SQL, assets, tests, config, unknown/new/deleted/renamed CSS or unavailable
comparison/evidence select the full gate. The comparison base must be a completed
successful main run with all four checks AND successful Pages publication.
Branch plans snapshot current main once; main uses the push's before SHA;
PRs use the base SHA; manual/unknown events use full coverage. Missing API/history
always means full coverage. Shards receive the same validated allowlist; failures
and skipped/cancelled prerequisites continue to block Pages.

Exact-SHA reuse also checks the source run's scope proof. A full successful gate
can satisfy any plan; a CSS gate can satisfy only the identical published base
and selected-screen signature. No partial/wrong-scope success is accepted.
CI policy changes themselves select the full gate. Verify mapping/partitions,
failure propagation and reuse locally, then every GitHub shard. A subsequent
CSS-only source-comment change verifies the real scoped path without changing UI.

## Local release queue ·2026-10-23

Concurrent final branch gates waste work when another task advances main before
integration. The final release interval is now cooperative FIFO, while editing
and scoped local checks remain parallel. The queue lives under
`git rev-parse --git-common-dir` (not the worktree), so all local worktrees share
it. It has no network access and does not push, run CI, terminate processes, or
grant permission to publish. A claimed ticket is NOT verification evidence.

1. Finish approved edits and scoped checks. Run
   `python3 cloud/release_queue.py join --owner codex/task-name` once and retain
   its returned ticket in the task's handoff. `status` shows owner and wait order.
2. Run `python3 cloud/release_queue.py claim --ticket TICKET`. Exit 2 means wait;
   do not push a final candidate while waiting. Check at sensible intervals or
   continue independent work. Only the oldest waiting ticket can claim a free slot.
3. After claim succeeds, fetch and reconcile latest main; finish candidate checks,
   then push the final branch candidate once. Every required shard must succeed.
4. Fetch again and fast-forward that exact tested SHA to main only if current
   main is still its ancestor. Existing exact-SHA/scope-proof rules remain intact.
5. Retain the slot until main's Pages run and public file readback finish. This
   also avoids another release invalidating the published-base scope proof.
   Then run `python3 cloud/release_queue.py leave --ticket TICKET`.

On a fixable gate failure keep the slot while fixing/rechecking that candidate.
If abandoning/pausing the release, first stop your own release activity, then
leave; any retry must join again and fetch/reconcile. Cancel an unused waiting
ticket with leave. Slots never time out or auto-steal: a crashed owner's ticket
must be explicitly reconciled with its task before release. Unknown tickets and
malformed state fail closed without replacing state. Atomic locked transactions
prevent simultaneous joins/claims from overwriting each other. Requires Python
stdlib and Git on macOS/Linux, with no packages, credentials or operational data.

This coordinates cooperating threads sharing one Git common directory. It does
not retroactively cover existing runs or independent clones/hosts; coordinate
those explicitly. If main changes externally, reconcile/reverify as before.
Do not use workflow-wide concurrency as a replacement: it does not reconcile
queued candidates and can supersede pending runs. Required checks, Pages gate,
freshness guard, exact-SHA evidence and all test coverage are unchanged.
