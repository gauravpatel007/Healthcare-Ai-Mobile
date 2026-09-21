# SOS contact phone verification

This adds phone proof to the existing SOS recipient eligibility check. Existing
LifeOS account consent, email opt-in, notification content, and delivery functions
are preserved. Phone verification alone does not accept an account invitation.
The current application has automated SOS calls/SMS disabled; this change does
not enable them. Existing contacts are pending until verified.

## Deploy

### Local use (no public URL or ngrok needed)

With the existing bot credentials saved in the backend environment, run these
commands from `backend/` using the application's Python environment:

```sh
python migrate_telegram_verification.py
python run_telegram_bot.py
```

Keep this worker running while testing. It switches the bot from webhook delivery
to polling, preserves queued updates, and sends replies over outgoing HTTPS. Run
only one worker for this bot. Stop it with Ctrl+C before switching back to a webhook.
`python setup_telegram.py` checks the bot and current delivery configuration without
changing it. A stopped worker cannot answer Telegram messages.

The bot now shows who requested the contact and the registered number's last four
digits. It requires **Confirm**, then **Share My Phone Number**. Confirm alone never
verifies a contact. Decline stops that chat's request. Plain `/start` resumes a valid
request in that chat or explains how to obtain a personal verification link.

**Share via WhatsApp** sends the Telegram verification link to the contact's entered
number; it works without a public LifeOS website. **Verify via Telegram** opens the
Telegram account signed in on the current device. Opening it as the LifeOS owner
cannot verify a different person's phone number.

The separate app/email invitation still requires the recipient to access a published
LifeOS website. For local/native builds, configure `VITE_PUBLIC_WEB_URL` with that
website's public address and rebuild. The UI no longer guesses a production IP or
sends localhost links. This does not remove the existing account-consent requirement
or enable live automated calls.

### Hosted deployment

1. Before starting the updated backend against an existing database, run from
   `backend/` with the application's Python environment:

   ```sh
   python migrate_telegram_verification.py
   ```

   This idempotently adds only the emergency-contact verification columns, unique
   token-hash index, and Telegram session table. Fresh databases also get the fields
   through the existing model initialization. Do not skip this migration on an
   existing database: `create_all` does not add columns to existing tables.

2. Create a bot with Telegram's BotFather and configure the backend environment
   (`backend/.env` for local development; the deployment environment in production):

   ```dotenv
   TELEGRAM_BOT_TOKEN=<BotFather token>
   TELEGRAM_BOT_USERNAME=<actual username without @>
   TELEGRAM_WEBHOOK_SECRET=<random URL-safe secret>
   ```

   Generate the webhook secret with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
   Keep both secrets server-side. Restart the backend after changing its settings.

3. Prefer `python setup_telegram.py --register`: it first checks the actual bot
   username, public webhook route, saved secret and database connectivity, and
   refuses registration if those checks fail. It never regenerates the saved secret.
   Alternatively, register the public HTTPS endpoint using `setWebhook`. Run this
   Python snippet from `backend/`, replacing only the public URL. It loads secrets
   from the existing application configuration; do not paste credentials into URLs
   in a browser or into logs.

   ```python
   import httpx
   from app.config import get_settings

   settings = get_settings()
   try:
       response = httpx.post(
           f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setWebhook",
           json={
               "url": "https://YOUR_BACKEND_HOST/api/v1/emergency/telegram/webhook",
               "secret_token": settings.TELEGRAM_WEBHOOK_SECRET,
               "allowed_updates": ["message"],
               "max_connections": 1,
           }, timeout=20,
       )
       print("Webhook registered" if response.is_success and response.json().get("ok")
             else "Registration failed; check bot credentials and HTTPS endpoint")
   except httpx.HTTPError:
       print("Telegram request failed; check connectivity")
   ```

   Use a bot dedicated to this feature: registering its webhook replaces any
   previous webhook. Preserve the `X-Telegram-Bot-Api-Secret-Token` header through
   the reverse proxy. Keep SQL debug logging and request/response-body logging off
   for verification traffic. The application audit logs contain only outcomes
   and internal contact IDs.

4. Build/deploy the frontend normally. Add a contact using an international number
   with `+` or `00` and its country code. Share its temporary Telegram link with
   that contact, who must press **Confirm**, then **Share My Phone Number** themselves.
   The visible Emergency page refreshes status every 15 seconds and when refocused.
   **Resend Verification** prepares a new link
   for manual sharing; it invalidates the previous link and any pending bot session.

## Security behavior

- Tokens contain 256 random bits, are stored only as SHA-256 hashes, and expire
  after 24 hours. Successful verification consumes them. No phone/email/contact ID
  is placed in the deep link.
- A token is tied to exactly one contact. Only private Telegram messages with
  matching sender, chat and contact user IDs qualify; forwarded contacts are rejected.
- International phone numbers are normalized by removing formatting, replacing
  `00` with `+`, and checking E.164 digit shape. Local numbers are rejected rather
  than guessing their country. Telegram's country-code digits accept a missing `+`.
- Five failed phone proofs invalidate the token. Each Telegram user is limited to
  thirty new messages per ten minutes, including invalid starts. Resend is limited to
  once per contact per minute. Limits live in the database, including across restarts
  and workers. PostgreSQL row locks serialize verification and contact edits.
- Duplicate/out-of-order messages are ignored using the private chat message ID.
  Phone changes reset verification and invalidate old tokens. Editing a name or
  email retains phone proof while preserving the existing account-consent reset.
- The SOS recipient query requires `verification_status == "verified"` in addition
  to all existing consent rules. Pending and unverified contacts receive no SOS
  inbox, push or email alerts. Telegram is used for verification only.

The handler returns `sendMessage` in the webhook response using the
[Telegram Bot API webhook-reply mechanism](https://core.telegram.org/bots/api#making-requests-when-getting-updates).
Telegram does not provide delivery confirmation for those replies; the committed
database status is authoritative. The contact button follows Telegram's
[request_contact API](https://core.telegram.org/bots/api#keyboardbutton), and webhook
authentication uses [setWebhook.secret_token](https://core.telegram.org/bots/api#setwebhook).

## Validation

From `backend/`:

```sh
python -m unittest discover -s tests -p 'test_telegram_verification.py' -v
python -m unittest discover -s tests -p 'test_emergency_consent*.py' -v
```

Tests use an isolated SQLite database and mocked delivery. They do not register a
webhook, send alerts, or exercise PostgreSQL concurrency. Finish deployment with a
real Telegram verification using a consenting test contact; try a mismatch as well.
