"""Polling transport tests without real Telegram traffic or production data."""
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@127.0.0.1:1/test"
import httpx
from run_telegram_bot import TelegramError, process_update, telegram_request


class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_delivery_retry_does_not_repeat_verification(self):
        db = SimpleNamespace(commit=AsyncMock())
        context = MagicMock()
        context.__aenter__ = AsyncMock(return_value=db)
        context.__aexit__ = AsyncMock(return_value=False)
        reply = {"method": "sendMessage", "chat_id": 123, "text": "Confirmed"}
        with patch("run_telegram_bot.AsyncSessionLocal", return_value=context), \
             patch("run_telegram_bot.handle_update", new_callable=AsyncMock, return_value=reply) as handler, \
             patch("run_telegram_bot.telegram_request", new_callable=AsyncMock, side_effect=[TelegramError(0), {}]) as send, \
             patch("run_telegram_bot.asyncio.sleep", new_callable=AsyncMock):
            await process_update({"update_id": 1}, object())
            handler.assert_awaited_once()
            db.commit.assert_awaited_once()
            self.assertEqual(send.await_count, 2)
            self.assertEqual(send.call_args.args[1], "sendMessage")

    async def test_ignored_updates_do_not_send_messages(self):
        context = MagicMock()
        context.__aenter__ = AsyncMock(return_value=SimpleNamespace(commit=AsyncMock()))
        context.__aexit__ = AsyncMock(return_value=False)
        with patch("run_telegram_bot.AsyncSessionLocal", return_value=context), \
             patch("run_telegram_bot.handle_update", new_callable=AsyncMock, return_value={"ok": True}), \
             patch("run_telegram_bot.telegram_request", new_callable=AsyncMock) as send:
            await process_update({}, object())
            send.assert_not_awaited()

    async def test_provider_errors_never_expose_bot_credentials(self):
        transport = httpx.MockTransport(lambda request: httpx.Response(401, json={"ok": False, "error_code": 401}))
        with patch("run_telegram_bot.get_settings", return_value=SimpleNamespace(TELEGRAM_BOT_TOKEN="private-token")):
            async with httpx.AsyncClient(transport=transport) as client:
                with self.assertRaises(TelegramError) as error:
                    await telegram_request(client, "getUpdates", {})
                self.assertEqual(error.exception.code, 401)
                self.assertNotIn("private-token", str(error.exception))
