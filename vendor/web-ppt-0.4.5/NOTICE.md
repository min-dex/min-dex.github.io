# web-ppt 0.4.5

Vendored MIT-licensed @web-ppt/core and @web-ppt/viewer-core from npm 0.4.5.
Only the browser runtime modules are included. No CDN or runtime npm install.
Core bundles fflate (MIT; https://github.com/101arrowz/fflate).
Original package licenses are retained. See upstream-fixes.patch for the
reviewed OOXML automatic-start / instantaneous appearance / stale-paint fixes.
viewer-core imports are relative to this directory for offline desktop use.
This renderer supports a subset of PowerPoint; it is not the Microsoft engine.

Mindex also omits mediacall timing entries: unsupported play/pause commands must
not become visible emphasis/fade effects. The app owns all output navigation
and disables independent hyperlinks and automatic slide advancement.
