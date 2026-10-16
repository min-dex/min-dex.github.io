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
