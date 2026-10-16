## Official ASV addition ·2026-10-16

User requested ASV in Mindex in addition to Biblia. Current active operational
catalogue is9, with288645 stored official rows; no edition was displaced.
ASV1901 eBible electronic source supplies66books/1189chapters/31102 numbered
segments, including16 source-authorized empty bodies with separate footnotes.
All native labels/order/bodies/headings agree across official USFM and USFX
exports using independent extractors. This is two-format consistency of one
electronic witness, not independent print certification. No KJV fallback fills
ASV's empty numbered markers. Source hashes and exact full-row readback receipt
are retained; the previous8 editions and personal/service data are unchanged.

DB: guarded additive transaction applied; independent public API readback matches
all31102 full rows and complete translation metadata. Local PostgreSQL18.4
confirmed compressed transport restoration, rollback, replay, future-edit guard
and exact preservation of257543 pre-existing fixture rows. Private transport
parts remain in mindex_maintenance.asv_transport_20261016 pending disposal; this
is new-source staging, not an old-body backup.

UX: source footnotes render separately from copy/output bodies. One-time renewal
targets only the reproducible translation catalogue cache, preserving current
chapter caches, notes and service records. ASV source/year information is added.
Local read/search/copy and source display pass. Deployment status is recorded in
docs/bible-asv-deployment-20261016.json. WEB is Biblia-only. NIV/ESV API access
remains pending accounts/licensed access; this addition does not activate them.
