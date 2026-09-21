"""Local Telegram worker: python run_telegram_bot.py (keep it running).

Uses outgoing HTTPS only, so no tunnel is needed. Switching to polling removes
the bot's webhook without dropping queued updates. Run one worker per bot.
"""
import asyncio
import logging

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal, engine
from app.models.emergency import TelegramVerificationSession
from app.services.telegram_verification import handle_update

logger = logging.getLogger("lifeos.emergency.telegram_worker")


class TelegramError(Exception):
    def __init__(self, code):
        self.code = code


async def telegram_request(client, method, payload):
    settings = get_settings()
    try:
        response = await client.post(f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}", json=payload)
        data = response.json()
    except (httpx.HTTPError, ValueError):
        raise TelegramError(0) from None
    if not data.get("ok"):
        raise TelegramError(data.get("error_code", response.status_code))
    return data.get("result")


async def process_update(update, client):
    async with AsyncSessionLocal() as db:
        result = await handle_update(update, db)
        await db.commit()
    if result.get("method") != "sendMessage":
        return
    payload = {key: value for key, value in result.items() if key != "method"}
    # Retry delivery without repeating the committed verification transition.
    for attempt in range(3):
        try:
            await telegram_request(client, "sendMessage", payload)
            return
        except TelegramError as error:
            if error.code in (400, 403):
                logger.warning("Bot reply rejected; recipient may have blocked the bot")
                return
            if attempt == 2:
                logger.warning("Bot reply could not be delivered; verification state remains saved")
                return
            await asyncio.sleep(2 ** attempt)


async def run():
    settings = get_settings()
    if not settings.TELEGRAM_BOT_TOKEN:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN in the backend environment.")
    engine.echo = False
    async with AsyncSessionLocal() as db:
        await db.execute(select(TelegramVerificationSession.confirmed_at).limit(0))
    async with httpx.AsyncClient(timeout=35) as client:
        me = await telegram_request(client, "getMe", {})
        if me["username"].lower() != settings.TELEGRAM_BOT_USERNAME.strip().lstrip("@").lower():
            raise RuntimeError("Configured bot username does not match the bot token.")
        await telegram_request(client, "deleteWebhook", {"drop_pending_updates": False})
        logger.info("LifeOS Telegram bot is running in polling mode; no public URL is needed")
        offset = None
        while True:
            try:
                updates = await telegram_request(client, "getUpdates", {
                    "offset": offset, "timeout": 25, "allowed_updates": ["message"],
                })
                for update in updates:
                    await process_update(update, client)
                    offset = update["update_id"] + 1
            except TelegramError as error:
                if error.code in (401, 409):
                    raise RuntimeError("Bot credentials were rejected or another worker/webhook is active.") from None
                logger.warning("Telegram connection interrupted; retrying")
                await asyncio.sleep(5)
            except Exception:
                logger.error("Verification update could not be processed; check database/migration. Retrying without logging private payloads.")
                await asyncio.sleep(5)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    for name in ("httpx", "httpcore", "sqlalchemy.engine"):
        logging.getLogger(name).setLevel(logging.WARNING)
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
    except Exception:
        logger.error("Telegram worker stopped. Check credentials, run migrate_telegram_verification.py, and ensure only one worker is running.")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
