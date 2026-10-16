# Publisher-specific supplemental books

User authorized the same reading taxonomy and supplemental-text support in both
Biblia and Mindex on2026-10-16. UX requirement: Old/New Testament plus
Deuterocanon/Apocrypha; show only books supplied by the selected edition, preserve
literal publisher chapter/verse labels, and render those labels in reading,
search, copy and presenter output. Esther/Daniel link to separate COG additions.

Data contract: additive COG supplemental books only in this batch. Existing
66-book verses, UUIDs, annotations and historical review evidence remain intact.
Nine global supplemental book codes are supplied only through translation
metadata.supplement_books. Chapter options carry positive internal key and literal
label; keys >=1000 are storage addresses, never displayed as verse/chapter names.
Verse metadata.source_label and source_order preserve split/relocated labels and
reading order. Do not infer alignment with another edition. Source is the dated
KBS COG electronic snapshot, not COGNEW. Empty publisher preface is unavailable.

No new permission grants/RLS changes or public scripture files. Guarded SQL
contains only new supplemental rows and a backed-up translation metadata update.
Production apply/readback and web deployment are separate checkpoints. Existing
66-book COG remains partially source-adopted; this addition does not certify it.
