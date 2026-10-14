# Verified Bible cache refresh

Release token: `20261014-bible-repair-cache-v2`. Base commit after reconciliation: `777ebd7f`.
Only the repair helper, release token/fallback, public address scope, regression
test and operational notes belong to this isolated release. Preserve other
threads' dirty primary checkout changes. No raw texts, SQL payloads or private
backups are included in this release.

Local checks and browser QA are recorded in the presenter decision log.
Production deployment and live-byte/UI verification are pending at preparation.

The overall original-edition audit remains incomplete. COG GEN1:22,30,31 follow-up is applied in production and Biblia; exact full-row read-back passed. A separate GEN1 cache suffix bypasses the earlier restoration cache.

Fresh home → Scripture → Genesis entry without reload displays all13 translations. COG GEN1 displays the corrected22,30,31 and prior10. Cache regression checks and bounded output fitting checks pass. Biblia31 Python tests pass, including exact original package reconstruction through both COG repair stages. Production deployment/read-back remains pending.
