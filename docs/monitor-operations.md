# Read-only operations panel

## Automatic presence · 2026-10-17

Opening a controller tab automatically registers presence, including browsers
with the former sharing preference disabled. The share toggle is removed; only
the optional connection name remains editable. The client sends exactly name,
os, browser and output. It no longer collects editing/save events, service IDs,
slide positions, app version or video details. Existing RPC validation accepts
this subset; no schema or permission changes are required.

Registration starts when the DB client becomes available; uploads retain the
15-second cadence, single-flight guard, timeout and backoff. Page hide requests
reporter removal and stops uploads; bfcache restoration registers again. Remote
rows still require a valid heartbeat within 45 seconds, so a lost close request
or offline browser disappears by timeout. Output-only windows never register.
Viewer authentication and automatic locking remain unchanged. The older sharing
and full-payload sections below are historical and superseded by this contract.


## Current compact view · 2026-10-17

The panel shows this browser and authenticated shared sessions with name, browser
identity and output on/off only. Remote rows require a successful read and a valid
heartbeat within 45 seconds; stale rows are excluded and failed reads clear the
list. This is heartbeat-based presence, not proof of a physical device or displayed
video. Local identity/sharing controls are collapsed. Sharing remains opt-in and
viewer authentication/locking is unchanged. Existing reporting payload, retention
and RPC permissions are unchanged; editing, save history and slide details are no
longer displayed. The UI details below describe the previous full view.


The Save-adjacent panel reports browser-tab sessions, not verified physical devices.
Sharing is opt-in on each browser. It reports environment, selected/output worship
identifiers, slide position, heartbeat/video state and the last 20 action categories.
Input contents, lyrics, attachments and raw error messages are not collected.

## Isolation and limits

- No monitor initialization on the presenter output route; no remote commands.
- Controller reports every 15 seconds, with one request chain in flight, a 4-second
  timeout and failure backoff up to 5 minutes. Viewer polling runs only while open.
- Reports older than 45 seconds are marked stale; background browser throttling can
  delay reports. This is sampled status, not a complete audit trail.
- Reporter sessions expire after 24 hours, viewers after 30 minutes. Expired rows
  are removed on registration/login, not by a scheduled retention job.
- Up to 100 reporter sessions and 10 viewer sessions. Reloading creates a new
  session. Names and state are self-reported and must not be treated as attestation.
- Five failed password attempts block all logins for the remainder of the global
  10-minute window. This protects the PIN endpoint but can temporarily block the
  administrator under deliberate abuse. A short PIN remains a weak password.

## Server setup

Apply `migrations/2026-09-13-readonly-monitor.sql` in the trusted Supabase SQL editor.
It creates isolated private tables and narrowly scoped RPCs, without changing
worship data or policies. Browser roles cannot read the private tables directly.

An administrator must set the password using the private `set_password(text)`
function in the trusted editor. Do not commit the actual password. Until configured,
registration and login fail closed. Changing the password revokes viewer sessions.
Remove any saved editor query containing the password after configuration.

Passwords and session tokens are not stored in client localStorage. Tokens are
held in memory; the server stores only token hashes. Closing the panel locks it.
Turning sharing off requests removal of that reporter's record. If offline, it
expires normally rather than silently claiming remote deletion succeeded.

## Panel hardening

The controller samples small state every two seconds; uploads remain every 15
seconds. Output connectivity uses the presenter's own heartbeat TTL. The displayed
slide is explicitly the controller selection, not proof of rendered output.
Invalid/stale timestamps and failed reads are not presented as verified live state.
Reporting errors and viewer errors have separate status areas; refresh can retry
reporting, and reconnection resumes reporting without changing worship state.

Device and action filters operate on the existing last-20-category report only.
Dates are shown with times; short session IDs distinguish identical device names.
This is still sampled operational history, not a durable audit log. No new data
fields, retention period, public permissions or database migration are introduced.

Viewer access locks when the document becomes hidden, after five minutes without
panel interaction, or after its 30-minute session lifetime. Locking clears the
password input and cached rows, aborts pending viewer requests, and revokes the
viewer token when reachable. Network/server errors never expose raw error text.
These changes do not strengthen a weak administrator password; configure a strong
password separately in the trusted server editor.

## Verification

The panel separates local sharing settings from authenticated remote viewing.
Device facts use labeled rows for editing, output and save state. Failed reads
remain explicitly unverified, including in the attention filter and empty state.
Polling preserves focus on the recent-activity disclosure; manually locking the
viewer returns focus to the password field. No telemetry fields or RPC contracts
change with this presentation update.

Run `tests/smoke_monitor.py`, `tests/smoke_monitor_isolation.py`, existing presenter
latency/video tests and service-save safety tests. SQL permission and validation
tests use `tests/test_monitor_sql.mjs` with PGLite installed outside the repository.
Production cross-session verification is a separate step after password setup.
