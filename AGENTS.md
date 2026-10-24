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
CSS-only publication uses the conservative affected-screen plan in
`cloud/check_scope.py`; mixed behavior/data/config/test changes retain the full
gate. Unknown scope or unverified baseline must fall back to the full gate.
Do not glob-run live/import/migration scripts: some can mutate production data.
Never equate a successful local check with cloud execution or Pages deployment.
Before push/integration fetch and reconcile the latest remote without discarding work.
Keep deployment and credential access out of setup scripts and default tests.

## Shared release queue

Prefer one coordinated batch of ready, approved changes over a release per chat.
The user authorizes routine coordination messages with other Mindex chats to
batch their ready, approved changes and report the shared result. Maintain all
required checks; reduce duplicate setup/gates through exact-SHA reuse. Do not
interrupt an already-running release or add scope after its final gate starts.
With user-authorized thread coordination, freeze exact commits and local checks,
have participating owners stop individual final gates and release their waiting
tickets, then let one coordinator own the batch ticket through publication.
Preserve work still in progress for a later batch; do not keep adding changes once
the final gate starts. Keep an already-running unrelated release intact. Record
included commits and report the shared result to the participating owners when
authorized. The combined SHA must pass every required check; component checks
alone do not authorize publication. Never take another owner's ticket yourself.

Before the final branch gate, follow docs/cloud-development.md's Local release
queue. All worktrees of this checkout share a FIFO slot in Git's common directory:
`python3 cloud/release_queue.py join --owner <task-branch>`, retain its ticket,
then `claim --ticket <ticket>`. Exit 2 means wait; do not start the final branch
gate or push main while waiting. Development and scoped local checks stay parallel.
Once claimed, fetch/reconcile latest main, batch the approved candidate, run its
required branch gate, fetch again, and fast-forward the exact verified SHA only
when main is still its ancestor. Keep the slot through Pages and public readback,
then `leave --ticket <ticket>`. Release on explicit abandonment after your work
has stopped; cancel your waiting ticket if no longer needed. Never expire/steal
another owner's slot or cancel its run. Existing runs are not retroactively locked.
If main changes outside this cooperative queue, reconcile and verify again;
never reuse another SHA or weaken required checks. Separate clones/hosts need
explicit coordination: this local queue cannot serialize them.
