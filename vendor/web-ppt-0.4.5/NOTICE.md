# web-ppt 0.4.5

Vendored MIT-licensed @web-ppt/core and @web-ppt/viewer-core from npm 0.4.5.
Only the browser runtime modules are included. No CDN or runtime npm install.
Core bundles fflate (MIT; https://github.com/101arrowz/fflate).
Original package licenses are retained. See upstream-fixes.patch for the
reviewed OOXML automatic-start / instantaneous appearance / stale-paint fixes.
viewer-core imports are relative to this directory for offline desktop use.
This renderer supports a subset of PowerPoint; it is not the Microsoft engine.

Mindex preserves supported main-sequence mediacall play/pause/stop commands as
nonvisual timing entries; object-click interactive sequences are not inserted
into normal Next navigation. Volume/mute/repeat settings are exposed to the app.
Explicit player mode works with SVG text; previews still use static badges.
The app owns playback, all output navigation, timers and media teardown, and
disables independent hyperlinks and automatic slide advancement. The media2
module URL revision refreshes the changed ESM dependency graph after deployment.

Playback settings additionally expose slide span, start/end trim, finite repeat
count/duration, separate object-click effects and media-end dependencies. These
are interpreted by Mindex native output players, not by a Microsoft runtime.
