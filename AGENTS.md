# Mindex agent instructions

Respond in concise Korean, with short English technical terms when useful.
Read CURRENT.md, HANDOFF.md and docs/README.md, then the relevant current contract.
Mindex is an independent church operations app, not an EX-series app.

Preserve unrelated changes and source evidence. Never read or print .env files,
credentials or private keys. Never bulk-upload backups or scripture corpora to
this public repository. Do not alter Biblia or its worktrees.
Production DB/schema/permissions and operational data are outside Cloud setup.
Use the existing atomic worship save path; preserve user lyrics, forms and versions.

## Cloud

Read docs/cloud-development.md. Setup: `bash cloud/setup.sh`.
Baseline: `.cache/cloud-venv/bin/python cloud/check.py`.
Run additional change-scoped tests; this baseline is not the complete suite.
For bounded UI changes, run relevant local unit/browser checks and rely on the
complete required GitHub gate before publication instead of repeating the full
local baseline. For CI-runner changes, test partition coverage/failure propagation
locally and verify every shard in GitHub. Never omit or bypass required CI checks.
Do not glob-run live/import/migration scripts: some can mutate production data.
Never equate a successful local check with cloud execution or Pages deployment.
Before push/integration fetch and reconcile the latest remote without discarding work.
Keep deployment and credential access out of setup scripts and default tests.
