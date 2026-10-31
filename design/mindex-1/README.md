# Mindex 1.0 preview candidate

Preview only; product version, app branding and packaging configuration remain unchanged.
Open `preview.html` directly. Preferences use `mindex1-preview.*`; first-run version is
`1.0.0`. They never read operational app settings. `design/mindex-2` stays unchanged.
No worship screenshots or scripture corpus are included in this candidate.

Native candidates wrap the existing approved Dawn PNGs: macOS ICNS (16–1024)
and Windows ICO (16/32/48/256), light and dark variants. `native/config-proposal.patch`
is an **unapplied** configuration suggestion choosing dark; app icons do not automatically
follow the webpage theme. No redesign, signing, app build or installation was performed.
`provenance.json` records the historical originals and generated candidate hashes.

Verification: Chromium and WebKit, both themes, first-run/reopen, collapse persistence,
390px overflow, storage denial, icon decoding and zero external HTTP requests PASS.
Screenshots are private output evidence, not shipped with the source.
Run `python design/mindex-1/verify_preview.py` with Playwright/Pillow installed.

Next release checks:
1. Freeze the final combined source; reconcile latest main and pass the required gate.
2. Explicitly activate approved branding/version separately; then create one exact-source
   web/native candidate and compare renderer identities. The earlier unsigned package
   (84bbf9cc) is not the latest web product (befc8730 checkpoint).
3. Confirm signing/notarization provisioning without exposing secrets.
4. Verify actual macOS ARM/Intel and Windows installation, signed upgrade, retained
   sessions/drafts/settings and recovery. Existing isolated package tests do not cover this.
5. Verify real capture/mixer/CH8/YouTube and physical mobile Remote. No actual broadcast
   or operational playback was used for this preview validation.

This is source READY, not approval to publish a signed 1.0 release.
