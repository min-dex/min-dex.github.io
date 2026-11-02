# Private packaging compatibility entry

This private package uses the official, integrity-locked minimatch11.0.1 engine.
It is not an old minimatch release or a copied matching implementation. Overrides
apply only to the reviewed3/5 consumers;9/10 use the official named API directly.

The callable CommonJS export is restored for asar/dir-compare. Legacy glob7 uses
`_glob` and String.match for individual path segments, so official Matcher.test
is exposed through Symbol.match. Strings and the official GLOBSTAR stay intact.
`mergeRows()` is intentionally a no-op in the subclass: glob7 indexes globSet
alongside set for nonull, and the newer row-merging optimization violates that
relationship. The official preprocessing limits run separately before this step;
security-limit child-process tests must continue to pass.

This is a pinned private-API boundary. Updating the engine requires source review,
representative old/new comparisons, real glob/asar/unpack tests, security audit,
exact packaged-runtime checks and supported-platform installer CI. It does not
implement every legacy API: makeRe, regexp, matchOne, slashSplit and legacy
`defaults().Minimatch` compatibility are not supported or silently emulated.
Current direct consumers do not call them. Higher optimization levels are not
claimed to preserve legacy parsed-row identities; their security limits are tested.

No audit ignore, false version label or security algorithm backport is used.
