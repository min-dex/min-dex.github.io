# Inline and year selection batch · 2026-10-30

Base: published 1cfc9c5e (20261030-ready-ui).

Included source components: inline bbda2800 + cb9dd2e0 + dfd7b121; lightweight replacement reason a268f6a2; setlist years b417795a; calendar years 41b480d1. Generated runtime files from component branches were excluded and rebuilt together.

The inline deferred-patch fix records cached markup only after the mounted DOM was updated; composition/caret and drafts remain protected. Setlist month is captured once per filter, preserving one consistent snapshot and avoiding repeated global reads. Audit thresholds are unchanged.

Combined scoped verification: inline editor Chromium/WebKit (IME, blur refresh, atomic failure/retry/late input), setlist years Chromium/WebKit, setlist return/back/year/month/search/scroll, replacement navigation names Chromium/WebKit, calendar years Chromium/WebKit (empty years, Advent, drafts, 1005-row pagination), period unit and SOLID audit. New year smokes are included in required cloud checks.

Excluded: cancelled 0bcb24c9 automatic leader feature, production data/schema writes, packaging, playback/output/printing. Existing songs, forms, names and unsaved drafts are preserved. Full GitHub gate, Pages and public evidence are required separately.
