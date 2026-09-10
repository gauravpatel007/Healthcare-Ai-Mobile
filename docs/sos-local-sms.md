# SOS location SMS: local testing

The SOS endpoint sends this body to every saved emergency contact with a phone number, using the signed-in profile name and the coordinates supplied by the device:

```text
SOS: Gaurav Patel needs urgent help. Loc: https://www.google.com/maps?q=23.0207834,72.4622436
```

The example coordinates are not hardcoded. Any Twilio trial-account prefix is provider-generated and is not added again by LifeOS. Location permission is requested with a six-second deadline. If it is unavailable, the message says `Location unavailable.` and the app warns that no Maps link was included. An IP location is not substituted. The Maps link is a snapshot of the location when SOS was requested.

## Current account blocker (2026-09-10)

A read-only check authenticated the locally configured account as active, type Trial. The configured sender was absent from the account-owned incoming-number list, but matched the sender of a recent delivered SMS. That message contained neither SOS text nor a Google Maps link. This does not demonstrate custom SOS SMS delivery.

[Twilio's current SMS trial documentation](https://www.twilio.com/docs/usage/trials/try-out-sms) only permits predefined template bodies. Custom SOS text with a dynamic location requires an account with custom messaging enabled. Changing the body, adding the trial prefix, or deploying the app cannot remove this restriction. The incoming-number check alone is not proof of a bad trial sender, because trial senders are provider-managed.

For an account restricted to templates, `TWILIO_SMS_TEMPLATE_ONLY=true` displays that specific limitation without sending a doomed custom request. Once custom messaging is enabled, use `false`, matching account credentials, and an SMS-capable `TWILIO_FROM_NUMBER`. The current implementation uses the same sender for calls and SMS, so select a sender supporting both. No account upgrade or environment credential change was performed by this update.

## Run locally

From the project root, start the backend in one PowerShell terminal:

```powershell
cd backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

In another terminal, from the project root:

```powershell
cd frontend-react
npm.cmd run dev
```

Open `http://localhost:5173`, sign in, check the profile name and saved emergency contact, and allow location access. Local PostgreSQL must be available with the configured connection settings. Restart the backend after environment changes; settings are cached. Process environment overrides `backend/.env`, which overrides root `.env`.

On a phone, `localhost` means the phone itself. For a desktop-hosted app accessed from a phone, use a secure HTTPS development origin for location permission. The Vite proxy routes API requests to local port 8000. A public tunnel is unnecessary for outbound SMS; it is needed for Twilio to fetch a locally hosted custom call recording.

Tapping SOS makes real notification requests to saved contacts. After custom messaging is enabled, verify the SMS arrives with the correct name and that its Maps link opens the device location. `SMS requests accepted` means Twilio accepted the request, not that the handset received it. Check later delivery status with this read-only diagnostic from `backend`:

```powershell
..\venv\Scripts\python.exe check_sos_provider.py --recent-sms
```

The diagnostic prints status and error codes, without message bodies or credentials. Rejected create requests may have no message record; the app preserves the safe error code/reason returned by Twilio. No public delivery callback is required for this manual local check.

## Automated checks (no notifications sent)

```powershell
# From backend
..\venv\Scripts\python.exe -m unittest discover -s tests -v
# From frontend-react
node --test qa/*.test.mjs
npm.cmd run build
```

Tests mock Twilio and database access for SOS, including the exact name/coordinates passed from the endpoint to the SMS request, provider failures, location denial/timeouts, and partial call/SMS results. No real SOS SMS or call was sent and no deployment was performed during this update.

Validation: 35 backend tests and 17 frontend tests passed, and the web production build succeeded. Vite reports existing bundle size and mixed import warnings. Real SMS receipt remains unverified and blocked by the custom-messaging account prerequisite above.
