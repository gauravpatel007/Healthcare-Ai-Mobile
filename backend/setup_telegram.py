"""Check Telegram or register a reachable webhook using saved backend settings.

python setup_telegram.py           # read-only diagnosis
python setup_telegram.py --register
For local development without public HTTPS: python run_telegram_bot.py
"""
import argparse
import logging
from urllib.parse import urlsplit

import httpx
from app.config import get_settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register", action="store_true")
    args = parser.parse_args()
    settings = get_settings()
    logging.getLogger("httpx").setLevel(logging.CRITICAL)
    if not settings.TELEGRAM_BOT_TOKEN:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN in the backend environment first.")
    base = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
    try:
        with httpx.Client(timeout=20) as client:
            me = client.get(base + "/getMe").json()
            if not me.get("ok"):
                raise SystemExit("Telegram rejected the configured bot credentials.")
            username = me["result"]["username"]
            if username.lower() != settings.TELEGRAM_BOT_USERNAME.strip().lstrip("@").lower():
                raise SystemExit("TELEGRAM_BOT_USERNAME does not match the configured bot token.")
            info = client.get(base + "/getWebhookInfo").json()
            if not info.get("ok"):
                raise SystemExit("Could not read Telegram webhook status.")
            info = info["result"]
            print(f"Bot: @{username}; queued updates: {info.get('pending_update_count', 0)}")
            print("Webhook:", info.get("url") or "None (use the local polling worker)")
            print("Last delivery error:", info.get("last_error_message") or "None")
            if not args.register:
                return
            public_url = settings.PUBLIC_API_URL.rstrip("/")
            parsed = urlsplit(public_url)
            if parsed.scheme != "https" or not parsed.hostname or parsed.query or parsed.fragment:
                raise SystemExit("A public HTTPS backend URL is required. For localhost, run python run_telegram_bot.py instead.")
            if not settings.TELEGRAM_WEBHOOK_SECRET:
                raise SystemExit("Set TELEGRAM_WEBHOOK_SECRET in the backend environment first.")
            webhook = public_url + "/api/v1/emergency/telegram/webhook"
            probe = client.post(webhook, json={}, headers={
                "X-Telegram-Bot-Api-Secret-Token": settings.TELEGRAM_WEBHOOK_SECRET,
                "ngrok-skip-browser-warning": "1",
            })
            if probe.status_code != 200 or probe.json().get("ok") is not True:
                raise SystemExit(f"Webhook check failed (HTTP {probe.status_code}). Existing registration was left unchanged.")
            result = client.post(base + "/setWebhook", json={
                "url": webhook, "secret_token": settings.TELEGRAM_WEBHOOK_SECRET,
                "allowed_updates": ["message"], "max_connections": 1,
            }).json()
            print("Webhook registered using the existing saved secret." if result.get("ok") else "Telegram rejected webhook registration.")
    except (httpx.HTTPError, ValueError):
        raise SystemExit("Telegram/backend connection failed. Check internet access and the public HTTPS address.") from None


if __name__ == "__main__":
    main()
