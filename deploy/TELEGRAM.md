# Telegram verification on AWS EC2

Compose runs `telegram_bot` as a persistent polling worker. No public HTTPS
webhook is required in this mode. The API issues verification links and the
worker processes replies; both must use the same bot and DATABASE_URL.

In the active server checkout's root `.env`, configure non-empty values for
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (without @), and
`TELEGRAM_WEBHOOK_SECRET` (a random 32+ character secret). The API currently
requires all three to issue links, including in polling mode. Preserve the
existing DATABASE_URL and SECRET_KEY. Do not print or commit credentials.

Use a separate Telegram bot for localhost. Stop any local worker using the
production token before starting the EC2 worker. Only one polling worker can
consume updates for that bot, and polling startup removes its webhook.

From the active checkout after updating these files:

```sh
docker-compose config --quiet
docker-compose up -d --build app telegram_bot
docker-compose ps
docker-compose logs --tail=80 telegram_bot
docker-compose exec app python backend/setup_telegram.py
```

Use `docker compose` instead if the server has the Compose v2 plugin. Rebuild
is required because Alembic revisions are copied into the image. Recreating
containers is required for changed environment settings. API startup runs
the additive Telegram migration; the worker waits for the API health check.
Do not remove volumes or restore a database dump.

Expected: app healthy, worker running, valid bot credentials, no webhook in
polling mode, and queued updates draining. If startup fails, inspect the app
logs as well. A 409 from Telegram means another worker or webhook is active;
401 means credentials were rejected. Pending updates alone cannot identify
which of these occurred.

In the deployed app, request a fresh verification link (old local links belong
to the local database), open it, confirm, and share the matching account's own
phone number. Refresh the contact to check its verified status.
