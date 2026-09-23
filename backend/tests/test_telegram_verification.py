"""Phone-verification security regressions; isolated DB, no Telegram/SOS traffic."""
import os
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@127.0.0.1:1/test"
from fastapi import FastAPI, HTTPException, Response
from fastapi.testclient import TestClient
from sqlalchemy import event, select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.database import Base, get_db
from app.dependencies import get_current_user_id
from app.exceptions import register_exception_handlers
from app.models.emergency import EmergencyContact, EmergencyContactConsent, TelegramVerificationSession, SOSLog
from app.models.notification import SystemNotification
from app.models.user import User, UserProfile
from app.routers.emergency import create_contact, update_contact, delete_contact, router, trigger_sos
from app.routers.emergency_telegram import create_verification
from app.schemas.emergency import EmergencyContactCreate, EmergencyContactUpdate, SOSAlertRequest
from app.services.telegram_verification import handle_update, normalize_phone, digest, SUCCESS, MISMATCH, MAX_CHAT_MESSAGES
from migrate_telegram_verification import migrate

SETTINGS = SimpleNamespace(TELEGRAM_BOT_TOKEN="test-token", TELEGRAM_BOT_USERNAME="LifeOSTestBot",
                           TELEGRAM_WEBHOOK_SECRET="test-webhook-secret")


class TelegramTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        @event.listens_for(self.engine.sync_engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
        async with self.engine.begin() as connection:
            tables = [User.__table__, UserProfile.__table__, EmergencyContact.__table__,
                      EmergencyContactConsent.__table__, TelegramVerificationSession.__table__,
                      SOSLog.__table__, SystemNotification.__table__]
            await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        self.enterContext(patch("app.services.telegram_verification.get_settings", return_value=SETTINGS))
        self.db.add_all([User(id=uid, email=f"{uid}@example.invalid", hashed_password="unused", is_verified=True)
                         for uid in ("sender", "recipient", "stranger")])
        await self.db.commit()
        self.contact = await create_contact(EmergencyContactCreate(name="Mom", phone="+91 98765 43210"), "sender", self.db)
        self.token = self.contact.verification_url.split("start=")[1]
        await self.db.commit()
        self.message_id = 0

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    async def message(self, actor=123, **fields):
        self.message_id += 1
        payload = {"message": {"message_id": self.message_id, "chat": {"id": actor, "type": "private"},
                               "from": {"id": actor}, **fields}}
        result = await handle_update(payload, self.db)
        await self.db.commit()
        return result

    async def start(self, token=None, actor=123, confirm=True):
        result = await self.message(actor=actor, text="/start " + (token or self.token))
        if confirm and result.get("reply_markup", {}).get("keyboard", [[{}]])[0][0].get("text") == "Confirm":
            await self.message(actor=actor, text="Confirm")
        return result

    async def share(self, phone="919876543210", actor=123, user_id=123, **fields):
        return await self.message(actor=actor, contact={"phone_number": phone, "user_id": user_id}, **fields)

    async def row(self):
        return await self.db.get(EmergencyContact, self.contact.id)

    async def test_create_pending_hash_only_and_normalization(self):
        self.assertEqual(self.contact.phone, "+919876543210")
        self.assertEqual(self.contact.verification_status, "pending")
        self.assertFalse(self.contact.telegram_verified)
        self.assertEqual((await self.row()).verification_token_hash, digest(self.token))
        self.assertNotIn("verification_token_hash", self.contact.model_dump())
        for value in ["+91 (98765) 43210", "0091-9876543210"]:
            self.assertEqual(normalize_phone(value), "+919876543210")
        for value in ["9876543210", "+91abc123", None, "+0 123456789", "+" + "9" * 16]:
            with self.assertRaises(HTTPException): normalize_phone(value)

    async def test_success_requires_own_contact_and_consumes_token(self):
        result = await self.start()
        self.assertEqual(result["reply_markup"]["keyboard"][0][0]["text"], "Confirm")
        self.assertIn("LifeOS Emergency Contact Verification", result["text"])
        self.assertEqual((await self.share())["text"], SUCCESS)
        row = await self.row()
        self.assertEqual(row.verification_status, "verified")
        self.assertTrue(row.telegram_verified)
        self.assertIsNotNone(row.verified_at)
        self.assertIsNone(row.verification_token_hash)
        self.assertIsNone(row.verification_expires_at)
        self.assertIn("no longer available", (await self.start())["text"])

    async def test_mismatch_foreign_missing_and_forwarded_contacts_do_not_verify(self):
        await self.start()
        for fields in [dict(phone="919876543211"), dict(user_id=456), dict(user_id=None),
                       dict(forward_origin={"type": "user", "sender_user": {"id": 123}})]:
            self.assertEqual((await self.share(**fields))["text"], MISMATCH)
            self.assertEqual((await self.row()).verification_status, "pending")
            self.assertFalse((await self.row()).telegram_verified)

    async def test_explicit_confirmation_is_required_before_phone_proof(self):
        self.db.add(UserProfile(user_id="sender", name="Gaurav"))
        await self.db.commit()
        prompt = await self.start(confirm=False)
        self.assertIn("Gaurav", prompt["text"])
        self.assertIn("3210", prompt["text"])
        self.assertNotIn("9876543210", prompt["text"])
        await self.share()
        self.assertEqual((await self.row()).verification_status, "pending")
        await self.message(text="Confirm", forward_origin={"type": "user"})
        await self.share()
        self.assertEqual((await self.row()).verification_status, "pending")
        confirmation = await self.message(text="Confirm")
        self.assertTrue(confirmation["reply_markup"]["keyboard"][0][0]["request_contact"])
        self.assertEqual((await self.row()).verification_status, "pending")
        self.assertEqual((await self.share())["text"], SUCCESS)

    async def test_plain_start_explains_missing_invitation_and_resumes_only_own_session(self):
        welcome = await self.message(text="/start")
        self.assertIn("personal verification link", welcome["text"])
        await self.start()
        resumed = await self.message(text="/start")
        self.assertEqual(resumed["reply_markup"]["keyboard"][0][0]["text"], "Confirm")
        await self.share()
        self.assertEqual((await self.row()).verification_status, "pending")

    async def test_decline_does_not_verify_or_invalidate_other_recipients_token(self):
        await self.start(confirm=False)
        self.assertIn("declined", (await self.message(text="Decline"))["text"])
        self.assertIn("no longer available", (await self.share())["text"])
        self.assertEqual((await self.row()).verification_status, "pending")
        await self.start(actor=456)
        self.assertEqual((await self.share(actor=456, user_id=456))["text"], SUCCESS)

    async def test_new_link_does_not_inherit_confirmation(self):
        await self.start()
        result = await create_verification(self.contact.id, "sender", Response(), self.db)
        await self.db.commit()
        await self.start(result["verification_url"].split("start=")[1], confirm=False)
        await self.share()
        self.assertEqual((await self.row()).verification_status, "pending")

    async def test_token_attempt_limit_persists_across_chats(self):
        for actor in range(100, 105):
            await self.start(actor=actor)
            await self.share(phone="919876543211", actor=actor, user_id=actor)
        row = await self.row()
        self.assertEqual(row.verification_status, "unverified")
        self.assertIsNone(row.verification_token_hash)
        self.assertIn("no longer available", (await self.start())["text"])

    async def test_expired_deleted_and_other_chat_sessions_cannot_verify(self):
        await self.start()
        self.assertIn("no longer available", (await self.share(actor=456, user_id=456))["text"])
        row = await self.row()
        row.verification_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await self.db.commit()
        self.assertIn("no longer available", (await self.share())["text"])
        await delete_contact(self.contact.id, "sender", self.db)
        await self.db.commit()
        self.assertIn("no longer available", (await self.start())["text"])

    async def test_resend_ownership_cooldown_and_old_session_invalidation(self):
        await self.start()
        with self.assertRaises(HTTPException) as error:
            await create_verification(self.contact.id, "stranger", Response(), self.db)
        self.assertEqual(error.exception.status_code, 404)
        response = Response()
        result = await create_verification(self.contact.id, "sender", response, self.db)
        await self.db.commit()
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertNotIn(self.token, result["verification_url"])
        self.assertIn("no longer available", (await self.share())["text"])
        self.assertIn("no longer available", (await self.start())["text"])
        with self.assertRaises(HTTPException) as error:
            await create_verification(self.contact.id, "sender", Response(), self.db)
        self.assertEqual(error.exception.status_code, 429)
        await self.start(result["verification_url"].split("start=")[1])
        self.assertEqual((await self.share())["text"], SUCCESS)

    async def test_phone_edit_requires_new_proof_and_name_edit_preserves_phone_proof(self):
        await self.start()
        await self.share()
        response = await update_contact(self.contact.id, EmergencyContactUpdate(name="Mother"), "sender", self.db)
        self.assertEqual(response.verification_status, "verified")
        response = await update_contact(self.contact.id, EmergencyContactUpdate(phone="+919876543211"), "sender", self.db)
        await self.db.commit()
        self.assertEqual(response.verification_status, "pending")
        self.assertFalse(response.telegram_verified)
        self.assertIsNone(response.verified_at)
        self.assertIn("no longer available", (await self.start())["text"])
        await self.start(response.verification_url.split("start=")[1])
        self.assertEqual((await self.share())["text"], MISMATCH)
        self.assertEqual((await self.share(phone="919876543211"))["text"], SUCCESS)

    async def test_token_cannot_verify_another_contact_or_be_replayed_after_switch(self):
        second = await create_contact(EmergencyContactCreate(name="Dad", phone="+919876543211"), "sender", self.db)
        await self.db.commit()
        await self.start()
        self.assertEqual((await self.share())["text"], SUCCESS)
        self.assertEqual((await self.db.get(EmergencyContact, second.id)).verification_status, "pending")
        await self.start(second.verification_url.split("start=")[1])
        replay = {"message": {"message_id": 2, "chat": {"id": 123, "type": "private"}, "from": {"id": 123},
                              "contact": {"user_id": 123, "phone_number": "919876543211"}}}
        self.assertEqual(await handle_update(replay, self.db), {"ok": True})
        self.assertEqual((await self.db.get(EmergencyContact, second.id)).verification_status, "pending")

    async def test_phone_edit_invalidates_an_in_progress_chat(self):
        await self.start()
        await update_contact(self.contact.id, EmergencyContactUpdate(phone="+919876543211"), "sender", self.db)
        await self.db.commit()
        self.assertIn("no longer available", (await self.share(phone="919876543211"))["text"])
        self.assertEqual((await self.row()).verification_status, "pending")

    async def test_invalid_starts_are_rate_limited_and_reset_after_window(self):
        for _ in range(MAX_CHAT_MESSAGES):
            await self.start("a" * 43)
        self.assertIn("Too many", (await self.start())["text"])
        session = await self.db.get(TelegramVerificationSession, 123)
        session.window_started_at = datetime.now(timezone.utc) - timedelta(minutes=11)
        await self.db.commit()
        self.assertIn("LifeOS Emergency", (await self.start())["text"])

    async def test_group_and_text_only_messages_never_verify(self):
        self.assertEqual(await self.message(chat={"type": "group", "id": 123}, text="/start " + self.token), {"ok": True})
        await self.start()
        result = await self.message(text="+919876543210")
        self.assertIn("Share My Phone Number", result["text"])
        self.assertEqual((await self.row()).verification_status, "pending")

    async def test_audit_does_not_log_phone_token_or_telegram_identity(self):
        with self.assertLogs("lifeos.emergency.verification", level="INFO") as logs:
            await self.start()
            await self.share()
        output = " ".join(logs.output)
        self.assertNotIn(self.token, output)
        self.assertNotIn(digest(self.token), output)
        self.assertNotIn("9876543210", output)
        self.assertIn("outcome=verified", output)

    async def test_sos_blocks_accepted_but_pending_contact_then_allows_verified(self):
        self.db.add(EmergencyContactConsent(contact_id=self.contact.id, status="accepted", recipient_user_id="recipient",
                                           recipient_email="recipient@example.invalid", email_opt_in=True))
        await self.db.commit()
        with patch("app.services.emergency_alerts.send_sos_email", return_value=(True, "accepted")) as email, \
             patch("app.services.emergency_alerts.send_push_notification") as push:
            result = await trigger_sos(SOSAlertRequest(), "sender", self.db)
            self.assertFalse(result.success)
            self.assertEqual(result.message, "Emergency contact must be verified before receiving SOS alerts.")
            email.assert_not_called()
            push.assert_not_called()
            self.assertIsNone((await self.db.execute(select(SystemNotification))).first())
            await self.start()
            await self.share()
            log = (await self.db.execute(select(SOSLog))).scalar_one()
            log.created_at = datetime.now(timezone.utc) - timedelta(minutes=2)
            await self.db.commit()
            self.assertTrue((await trigger_sos(SOSAlertRequest(), "sender", self.db)).success)
            email.assert_called_once()

    async def test_verified_phone_alone_does_not_bypass_existing_account_consent(self):
        await self.start()
        await self.share()
        self.assertFalse((await trigger_sos(SOSAlertRequest(), "sender", self.db)).success)

    async def test_mixed_recipients_deliver_only_to_verified_contact(self):
        pending = await create_contact(EmergencyContactCreate(name="Pending", phone="+919876543211"), "sender", self.db)
        self.db.add_all([
            EmergencyContactConsent(contact_id=self.contact.id, status="accepted", recipient_user_id="recipient",
                                    recipient_email="recipient@example.invalid", email_opt_in=True),
            EmergencyContactConsent(contact_id=pending.id, status="accepted", recipient_user_id="stranger",
                                    recipient_email="stranger@example.invalid", email_opt_in=True),
        ])
        await self.db.commit()
        await self.start()
        await self.share()
        with patch("app.services.emergency_alerts.send_sos_email", return_value=(True, "accepted")) as email:
            result = await trigger_sos(SOSAlertRequest(is_silent=True), "sender", self.db)
            self.assertTrue(result.success)
            email.assert_called_once()
            self.assertEqual(email.call_args.args[0], ["recipient@example.invalid"])
        recipients = (await self.db.execute(select(SystemNotification.target_audience))).scalars().all()
        self.assertEqual(recipients, ["recipient"])


class TelegramHttpTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router, prefix="/api/v1")
        register_exception_handlers(self.app)
        self.app.dependency_overrides[get_db] = lambda: object()
        self.client = TestClient(self.app)
        self.enterContext(patch("app.routers.emergency_telegram.get_settings", return_value=SETTINGS))

    def test_webhook_requires_secret_not_a_user_login(self):
        for header in [{}, {"X-Telegram-Bot-Api-Secret-Token": "wrong"}]:
            self.assertEqual(self.client.post("/api/v1/emergency/telegram/webhook", json={}, headers=header).status_code, 403)

    def test_link_issuance_requires_existing_authentication(self):
        self.assertEqual(self.client.post("/api/v1/emergency/contacts/other/telegram-verification").status_code, 401)

    def test_authenticated_webhook_returns_bot_reply_after_commit(self):
        db = SimpleNamespace(commit=AsyncMock())
        self.app.dependency_overrides[get_db] = lambda: db
        with patch("app.routers.emergency_telegram.handle_update", new_callable=AsyncMock) as handler:
            handler.return_value = {"method": "sendMessage", "chat_id": 123, "text": "Verified"}
            response = self.client.post("/api/v1/emergency/telegram/webhook", json={"update_id": 1},
                headers={"X-Telegram-Bot-Api-Secret-Token": SETTINGS.TELEGRAM_WEBHOOK_SECRET})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["method"], "sendMessage")
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            db.commit.assert_awaited_once()

    def test_cannot_promote_status_using_contact_input(self):
        data = EmergencyContactCreate(name="X", phone="+919876543210", verification_status="verified", telegram_verified=True)
        self.assertNotIn("verification_status", data.model_dump())
        self.assertNotIn("telegram_verified", EmergencyContactUpdate(telegram_verified=True).model_dump(exclude_unset=True))


class MigrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_contact_defaults_pending_and_migration_is_repeatable(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                await connection.execute(text("CREATE TABLE emergency_contacts (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255), phone VARCHAR(20))"))
                await connection.execute(text("INSERT INTO emergency_contacts VALUES ('legacy', 'Mom', '+919876543210')"))
                await connection.run_sync(migrate)
                await connection.run_sync(migrate)
                row = (await connection.execute(text("SELECT name, phone, verification_status, telegram_verified, telegram_chat_id FROM emergency_contacts"))).one()
                self.assertEqual(tuple(row), ("Mom", "+919876543210", "pending", 0, None))
        finally:
            await engine.dispose()


if __name__ == "__main__":
    unittest.main()
