# Authoritative-only scripture library

User decision (2026-10-16): remove the old bundle from active loading; use
identified publisher/electronic witnesses throughout both apps.

The active catalogue is8 editions: CrossWire KJV3.1, KBS GAE/HAN/SAE/COG/
COGNEW/SAENEW, and publisher-directed GODpia Easy. These identify electronic
witnesses, not an assertion of exact printing or publisher infallibility.

COG/COGNEW/SAENEW use separate stable edition UUIDs/address namespaces and
102031 source segments. Every segment independently agrees with HTMLParser
extraction; original source page SHA256, literal labels, order and headings are
checked. Literal moved/split verse labels and JOB's special `(24)` chapter
remain source-native; COGNEW DAN13–14 belongs to DAN. No cross-edition numeric
alignment or guide correspondence is inferred for source-native editions.

The previous partial COG catalogue and7 unverified editions are reversibly
inactive. Existing verses, personal notes and service documents retain their
original identities. Biblia moves their packages outside its served assets;
retired bookmark navigation never silently substitutes another edition. New
reading/search/citation uses the active catalogue only, including stale-client
catalogue filtering through canonical_source metadata and a new query cache key.
Historical service documents may retain quoted text and must not be silently
rewritten as a new edition. Historical receipts remain truthful and unchanged.

CEV acquisition is not adoption:154 pages require further interpretation of
publisher HTML/number ordering, including EXO21. It is not exposed as verified.
No missing text or headings are filled from the old bundle. The old import
entry point is retired; official KJV's source serialization is still OSIS XML,
which is unrelated to the discarded EasySlides bundle's source reliability.

Private staging uses checksum-checked bounded Unicode transport, no extensions
or permanent functions. The final transaction checks all26parts, full prior
translation records, distinct new IDs, all102031 inserted rows, replay/drift,
and metadata-only reversible retirement. Staging has RLS and no public/anon/
authenticated grants. Full source bodies/private SQL are never committed.

Operational application, readback, deployment and browser results are recorded
separately in bible-authoritative-library-status-20261016.json.


## Legacy payload purge ·2026-10-16

User explicitly requested a chat-only account of the old bundle and removal of
its remnants. The original archive, whole legacy JSON/XML-derived corpora,
rollback copies, old whole-body receipts and obsolete replay/import tools are
permanently removed locally. Historical sections above describe past states:
original-corpus reconstruction and old backup dependencies no longer apply.
Compact source/hash receipts and reviewed encyclopedia excerpts retain their
named witness and review scope; they do not certify the current publisher text.
All eight official runtime package hashes are unchanged. Publisher HTML and
the separately authoritative CrossWire OSIS source remain valid source evidence.
No personal notes, bookmarks, service documents or lyrics were modified.

Production retains eight inactive legacy/partial editions,253140 verse rows.
Guarded deletion SQL and synthetic PostgreSQL rollback/replay/drift/FK/trigger
tests pass; production permanent deletion is PENDING action-time confirmation.
Do not report those rows or private production backups as deleted. Mindex
clears only reproducible scripture/catalogue caches once; personal storage stays.
See Biblia/reports/legacy-payload-purge-20261016.json and
Mindex/migrations/2026-10-16-bible-legacy-purge.sql.


## Edition history display ·2026-10-16

User authorized operational deployment of the reviewed edition/year display.
A compact disclosure separates documented publication/revision history, the
installed electronic witness, acquisition date and unconfirmed physical printing.
Current eight Bible bodies/metadata and user/service records are unchanged.
NIV2011 and ESV2025 are requested additions, not installed or falsely selectable.
Official API application/access is pending; never expose provider keys in the
frontend or mirror API corpora without the applicable permission. Mindex target
is10 editions including NIV/ESV; Biblia's verified collection remains uncapped.
