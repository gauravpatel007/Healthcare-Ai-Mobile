# Emergency contact invitations

Contacts start **Pending**, including contacts saved before this feature was added.
The owner selects **Invite via WhatsApp**. This opens a draft in the contact's chat;
the owner must press Send. Phone numbers must include a country code (for example,
`+91` followed by the Indian number). No Twilio/WhatsApp messaging API is used.

The recipient follows the personal link, signs in using the existing login/signup
flow, and explicitly accepts app alerts. Email alerts are opt-in. If the sender
supplied a contact email, that account must accept. Otherwise the accepting account
is shown to the sender. A shared/forwarded link is **not proof of phone ownership**.
Automatic SOS calls and SMS are disabled; manual tap-to-call remains available.

## Delivery and recipient control

- Only accepted, active accounts get SOS alerts. In-app alerts are saved privately
  before network delivery attempts and appear in the notification bell and SOS inbox.
- Emails go only to the accepting account's verified email at acceptance, never an
  arbitrary address supplied by the sender. They require the existing SMTP setup.
- Mobile push uses the existing recipient device subscription and existing OneSignal
  configuration. No push/email delivery or read guarantee is claimed.
- Recipients can stop alerts under **My received SOS alerts & consent**. Editing a
  contact's name, number or email resets acceptance. Deleting a contact removes consent.
- Links are random, hashed at rest, expire after seven days and can be used once.
  Generating another invitation invalidates the previous link. Tokens use the URL
  fragment and POST bodies rather than query strings/server access-log paths.
- Repeated SOS dispatches from one account are limited to one per minute. A delivery
  already in progress may complete after consent is revoked.

## Deployment

Deploy frontend and backend together. Backend startup registers and creates the new
`emergency_contact_consents` table. For explicit migration, run
`python migrate_emergency_consent.py` from `backend` using the configured application
environment. It only creates the new table; existing contact tables are not altered.

For the website, invitations use its current origin. Serve the SPA route
`/emergency-invitation` through the usual frontend fallback, with HTTPS in production.
For an Android build, set `VITE_PUBLIC_WEB_URL=https://your-live-website.example`
at build time so invitees get the public website instead of the app's local origin.
Localhost invitation links cannot be opened on another person's device.

No new dependency or paid messaging subscription is required by this flow. App inbox
storage uses the existing database; email/push availability and hosting quotas depend
on the services already configured. No live messages are sent by the tests.

## Verification

From `backend`: `python -m unittest discover -s tests -p test_emergency_consent.py -v`
and `python -m unittest discover -s tests -p test_emergency_consent_http.py -v`.
From `frontend-react`: `node --test qa/emergencyInvitations.test.mjs qa/sosLocation.test.mjs`.

Manual check with two test accounts: create a contact with country code, share the
WhatsApp draft, log in as the recipient, accept, trigger SOS from the sender, check
the recipient inbox, revoke, then confirm a later SOS does not notify that account.
