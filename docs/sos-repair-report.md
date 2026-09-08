# SOS repair report — 2026-09-08

Changes are local only. No deployment, server restart, database migration against production, SMS, or phone call was performed. Existing user edits were preserved.

## Latest follow-up: failed custom recording on localhost

The configured public origin now points to an ngrok URL. A GET for the existing saved MP3 returned HTTP 404 with text/html, while the local file exists and has an MP3 ID3 header. No ngrok inspector was reachable on localhost:4040 and no installation was found in PATH or the standard locations checked. This is evidence of an inaccessible public recording, not invalid Twilio authentication.

Added a bounded audio preflight (status, MIME, file signature), falling back to a full spoken SOS instead of putting a known-broken URL into Play. Even when audio is reachable, the full spoken alert precedes playback. Spoken alerts include supplied coordinates and do not claim an SMS was delivered. Public audio can still become unavailable after the check; the preflight is not a delivery guarantee.

Added explicit local template-only SMS configuration so the current trial reports that the location SMS was not sent, rather than returning a generic provider exception. Disable that flag once custom messaging is actually enabled. Frontend partial results now preserve accepted call requests and recording-fallback information alongside SMS failures.

Validation: 28 backend and 11 frontend tests passed. The local backend runs with --reload. No new calls/SMS were intentionally sent by this follow-up. The custom recording tunnel is still unavailable; a publicly reachable audio origin is required to play the original recording. No production deployment was performed.

## Earlier follow-up: voice retry completed

The authorized test call initially failed with HTTP 400/code 0: the trial rejected inline TwiML parameters. Retrying with a public TwiML URL was accepted; Twilio subsequently reported completed, duration 6 seconds. Only the harmless test message was used: LifeOS test call. This is not an emergency. Failed requests created no call.

Implemented TWILIO_VOICE_USE_URL (default false), enabled in both local environment files. This sends the same generated voice instructions through Twilio's Echo Twimlet using the URL parameter accepted by this trial. Voice text and any audio URL are carried in that URL, so request URLs must not be logged; credentials are never included. This adds a dependency on Twilio's Echo service. Inline mode remains available for accounts that support it.

Also distinguished trial-feature denials from bad credentials, fixed local/private custom audio origins to fall back to spoken SOS, and removed the voice claim that an SMS had been sent. Regression suite: 24 backend tests passed.

Custom SOS SMS remains unavailable under this account's documented template-only trial restrictions. No unrelated SMS template was substituted. No production deployment or local server restart was performed; existing backend processes must reload the updated settings. A completed provider call does not prove an actual emergency recipient understood the alert.

## Earlier follow-up: signed-in account configured

The user signed in to a different active trial account. Its current live credentials were copied into root .env and backend/.env, with the sender shown by both the SMS and Voice trial panels (+1 737 221 2163). A fresh read-only diagnostic using the saved settings succeeded: authentication accepted, account active. No secrets are recorded here.

The earlier authentication blocker is resolved for newly started local processes using these files. Existing processes cache settings and need a restart; production settings remain unchanged. No restart or deployment was performed during this follow-up.

The trial sender does not appear in the account-owned incoming-number list; it is shown explicitly in the Console's trial API examples. Do not treat it as a purchased production number. Current Twilio trial documentation restricts SMS to preset templates, so custom SOS text/location is still blocked by the account tier. Voice supports custom TwiML, but delivery has not been tested. Verified-recipient and trial restrictions still apply. An account upgrade or restored access to the original production-capable account is needed for custom SMS; neither was performed.

References: https://www.twilio.com/docs/usage/trials and https://www.twilio.com/docs/usage/trials/try-out-voice

The previous advice that the supplied credential lengths were incomplete was incorrect; the Console values were complete and authenticated successfully.

## Original diagnosis (before the follow-up)

A read-only Twilio account fetch using the saved local Account SID and Auth Token returned Twilio 20003, matching the reported SMS/call error. Both local .env files contain the same Twilio values, without extra whitespace. The values pass format validation but Twilio rejects authentication. This is not evidence that the phone number is wrong.

Twilio documents incorrect/revoked credentials, account suspension and account scope as possible causes: https://www.twilio.com/docs/api/errors/20003?display=embedded

Actual SOS delivery is NOT restored yet. In Twilio Console, verify the account is active and retrieve the matching live Account SID/Auth Token for the account that owns the sender number. Replace invalid credentials securely in the local environment and, when deployment is authorized, the server environment. Never put a token in this report or chat. This task did not have Twilio Console access or a valid replacement token.

Run `python check_sos_provider.py` from backend using the project virtual environment after updating credentials. It only fetches account status. Restart local backend processes after changing settings. Docker containers will eventually need recreation to receive new environment values; that was not done. Provider authentication success still does not prove sender capabilities, trial-recipient verification, destination permissions, or actual delivery.

## Implemented

- Deterministic settings precedence: process environment, then backend/.env, then root .env, independent of launch directory. Trim Twilio settings and validate their formats without exposing secrets.
- Safe SMS/call errors instead of raw Twilio request URLs, account identifiers and terminal escape codes. Explain authentication, trial-recipient, destination and invalid-number failures.
- Ten-second Twilio HTTP timeout with automatic retries disabled. Stop contacting further recipients on a shared authentication failure. Preserve accepted-request/partial-failure reporting and do not treat an empty recipient list as success.
- Normalize formatted phone numbers, retaining the existing India default for ten-digit numbers.
- Handle old backend authentication errors in the frontend, producing one concise error instead of the repeated raw error shown in the screenshot.
- Add a standalone read-only provider diagnostic and mocked regression coverage.
- Forward SMTP credentials through Compose so email notification fallback can be configured.
- Correct standalone Docker backend import path and use one worker to avoid starting four copies of the in-process medication scheduler.
- Correct Alembic script location and Compose migration execution directory. Stop hiding migration errors. Make the existing migration tolerate an already-present column and a fresh database (the application currently creates fresh tables during startup).
- Exclude nested environment files, database copies, history and dependencies from Docker image input.
- Fix leaderboard avatar zoom and admin medical-record links that incorrectly pointed to localhost after deployment.
- Record the SQLite test dependency in requirements-dev.txt.

## Verification

- 21 backend tests passed, covering reminders, SOS dispatch, provider failures, configuration precedence and migration repeatability.
- 10 frontend tests passed, including the legacy authentication error from the screenshot.
- Web production build and Android-mode web asset build passed. Vite still reports existing bundle-size/mixed-import warnings. No APK was packaged or installed.
- Read-only live checks: `/` returned 200 HTML; `/openapi.json` returned 200 JSON; a nonexistent upload returned 404 JSON. The previously documented upload fallback defect was not reproduced today.
- No real notifications were sent. PostgreSQL migration execution and Docker runtime startup were not tested; migration regression uses an isolated SQLite database.

## Audit limits and follow-up findings

This is not a claim that every application flow is now free of defects. Authenticated device/server flows were not exercised. Twilio access remains the primary blocker.

The wearable feature labeled Fitbit currently uses Google OAuth/Fitness endpoints, a localhost callback and a simulation fallback. It needs a separate provider integration correction and registered callback configuration; it was not silently replaced with a different integration in this repair.

Custom SOS audio requires PUBLIC_API_URL to be publicly reachable; the router's local fallback cannot be fetched by Twilio. Set the public origin before testing custom audio. Plain HTTP hosting can also restrict browser location/microphone access; HTTPS hosting remains a server configuration task.
