MindexSans-Common.woff2 is a Modified Version of PretendardVariable.woff2 made for
Mindex under the SIL Open Font License 1.1 (see LICENSE.txt in this directory).

- Contents: Latin, punctuation, symbols, and the 2,350 KS X 1001 Hangul syllables plus
  every non-ASCII character used by the app's UI source. Variable weight axis and layout
  features are kept.
- The internal font names were changed to "MindexSans" because the Reserved Font Name
  "Pretendard" may not be used by a Modified Version. The unmodified
  PretendardVariable.woff2 stays alongside it and is fetched only for characters the
  subset does not contain (CSS unicode-range in styles.css).
- Regenerate with the recipe in the commit that added this file (fontTools subsetter).

Content-addressed UI segments (2026-10-17):
- MindexSans-<SHA256 prefix>.woff2 files partition the exact Common cmap.
- ui-segments.json pins groups, source hash and derived file hashes.
- tools/build_ui_font_segments.py regenerates them using fontTools 4.60.2 and
  Brotli 1.2.0. Existing group membership stays fixed on subsequent builds.
- Variable axes, layout features, names, outlines and advances are preserved;
  tests/test_ui_font_segments.py compares every glyph at weights45/400/700/930.
- CSS requests only segments containing visible characters. Latin/punctuation/symbols remain together to preserve kerning and share
  the MINDEX wordmark preload; rare characters retain the unmodified full font.
- Original Common is retained for reproducibility and comparison, not preload.
- Retain already published hashed segments: cached older CSS can reference them.
