"""Consent/SOS integration tests. Isolated SQLite and mocked outbound delivery."""
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@127.0.0.1:1/test"
from fastapi import HTTPException
from sqlalchemy import select, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.database import Base
from app.models.emergency import EmergencyContact, EmergencyContactConsent, SOSLog
from app.models.notification import SystemNotification
from app.models.user import User, UserProfile
from app.routers.emergency import create_contact, update_contact, delete_contact, trigger_sos, list_contacts
from app.routers.emergency_consent import (create_invitation, preview_invitation, accept_invitation,
    revoke_consent, accepted_contacts, received_alerts, InvitationToken, AcceptInvitation, whatsapp_number)
from app.schemas.emergency import EmergencyContactCreate, EmergencyContactUpdate, SOSAlertRequest
from app.services import emergency_alerts


class ConsentTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        @event.listens_for(self.engine.sync_engine, "connect")
        def foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")
        async with self.engine.begin() as connection:
            tables = [User.__table__, UserProfile.__table__, EmergencyContact.__table__,
                      EmergencyContactConsent.__table__, SOSLog.__table__, SystemNotification.__table__]
            await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        for uid in ["sender", "recipient", "stranger"]:
            self.db.add(User(id=uid, email=f"{uid}@example.invalid", hashed_password="unused", is_verified=True))
        await self.db.flush()
        self.db.add_all([UserProfile(user_id="sender", name="Sender"),
            UserProfile(user_id="recipient", name="Recipient", push_device_token="recipient-push")])
        await self.db.commit()
        self.contact = await create_contact(EmergencyContactCreate(name="Contact", phone="+91 98765 43210"), "sender", self.db)
        await self.db.commit()
        self.email = self.enterContext(patch.object(emergency_alerts, "send_sos_email", return_value=(True, "accepted")))
        self.push = self.enterContext(patch.object(emergency_alerts, "send_push_notification", return_value=(True, "accepted")))
        self.calls = self.enterContext(patch("app.utils.email.send_sos_call_twilio"))
        self.sms = self.enterContext(patch("app.utils.email.send_sos_sms_twilio"))

    async def asyncTearDown(self):
        self.calls.assert_not_called()
        self.sms.assert_not_called()
        await self.db.close()
        await self.engine.dispose()

    async def invite(self):
        result = await create_invitation(self.contact.id, "sender", self.db)
        await self.db.commit()
        return result["token"]

    async def accept(self, email=True):
        token = await self.invite()
        await accept_invitation(AcceptInvitation(token=token, consent=True, email_opt_in=email), "recipient", self.db)
        # These tests isolate account consent/delivery after phone proof.
        contact = await self.db.get(EmergencyContact, self.contact.id)
        contact.verification_status = "verified"
        contact.telegram_verified = True
        contact.verified_at = datetime.now(timezone.utc)
        await self.db.commit()

    async def test_new_and_legacy_contacts_pending_send_nothing(self):
        self.db.add(EmergencyContact(user_id="sender", name="Legacy", phone="+919999999999", email="victim@example.invalid"))
        await self.db.commit()
        self.assertTrue(all(c.consent_status == "pending" for c in await list_contacts("sender", self.db)))
        result = await trigger_sos(SOSAlertRequest(), "sender", self.db)
        self.assertFalse(result.success)
        self.email.assert_not_called()
        self.push.assert_not_called()
        self.assertEqual(await received_alerts("recipient", self.db), [])

    async def test_invite_is_hashed_preview_does_not_accept(self):
        token = await self.invite()
        consent = await self.db.get(EmergencyContactConsent, self.contact.id)
        self.assertNotEqual(consent.token_hash, token)
        self.assertEqual(len(consent.token_hash), 64)
        info = await preview_invitation(InvitationToken(token=token), self.db)
        self.assertEqual(info["sender_name"], "Sender")
        self.assertEqual(consent.status, "pending")
        self.assertNotIn("email", info)

    async def test_explicit_international_phone_and_contact_ownership(self):
        self.assertEqual(whatsapp_number("+91 98765 43210"), "919876543210")
        self.assertEqual(whatsapp_number("0091 98765 43210"), "919876543210")
        for phone in ["9876543210", "+91abc123", "", "+0 123456789"]:
            with self.assertRaises(HTTPException): whatsapp_number(phone)
        with self.assertRaises(HTTPException) as error:
            await create_invitation(self.contact.id, "stranger", self.db)
        self.assertEqual(error.exception.status_code, 404)

    async def test_expired_replaced_and_used_links_rejected(self):
        old = await self.invite()
        token = await self.invite()
        with self.assertRaises(HTTPException): await preview_invitation(InvitationToken(token=old), self.db)
        row = await self.db.get(EmergencyContactConsent, self.contact.id)
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await self.db.commit()
        with self.assertRaises(HTTPException):
            await accept_invitation(AcceptInvitation(token=token, consent=True), "recipient", self.db)
        token = await self.invite()
        await accept_invitation(AcceptInvitation(token=token, consent=True), "recipient", self.db)
        await self.db.commit()
        with self.assertRaises(HTTPException):
            await accept_invitation(AcceptInvitation(token=token, consent=True), "stranger", self.db)

    async def test_accept_requires_consent_verified_account_and_not_self(self):
        token = await self.invite()
        for who, agree in [("recipient", False), ("sender", True)]:
            with self.assertRaises(HTTPException):
                await accept_invitation(AcceptInvitation(token=token, consent=agree), who, self.db)
        user = await self.db.get(User, "recipient")
        user.is_verified = False
        await self.db.commit()
        with self.assertRaises(HTTPException):
            await accept_invitation(AcceptInvitation(token=token, consent=True), "recipient", self.db)

    async def test_optional_email_binds_to_intended_account(self):
        await update_contact(self.contact.id, EmergencyContactUpdate(email="recipient@example.invalid"), "sender", self.db)
        token = await self.invite()
        with self.assertRaises(HTTPException):
            await accept_invitation(AcceptInvitation(token=token, consent=True), "stranger", self.db)
        await accept_invitation(AcceptInvitation(token=token, consent=True), "recipient", self.db)
        await self.db.commit()
        result = (await list_contacts("sender", self.db))[0]
        self.assertEqual(result.consent_status, "accepted")
        self.assertEqual(result.accepted_by, "recipient@example.invalid")

    async def test_only_recipient_account_gets_email_push_and_private_inbox(self):
        await self.accept()
        result = await trigger_sos(SOSAlertRequest(latitude=0, longitude=0, is_silent=True), "sender", self.db)
        self.assertTrue(result.success)
        self.email.assert_called_once_with(["recipient@example.invalid"], "Sender", "https://www.google.com/maps?q=0.0,0.0")
        self.assertEqual(self.push.call_args.args[0], "recipient-push")
        alerts = await received_alerts("recipient", self.db)
        self.assertEqual(len(alerts), 1)
        self.assertIn("maps?q=0.0,0.0", alerts[0]["message"])
        self.assertEqual(await received_alerts("stranger", self.db), [])
        self.assertEqual(await received_alerts("sender", self.db), [])

    async def test_email_opt_out_keeps_app_alerts(self):
        await self.accept(email=False)
        self.assertTrue((await trigger_sos(SOSAlertRequest(), "sender", self.db)).success)
        self.email.assert_not_called()
        self.assertEqual(len(await received_alerts("recipient", self.db)), 1)

    async def test_account_email_change_does_not_authorize_new_address(self):
        await self.accept()
        user = await self.db.get(User, "recipient")
        user.email = "changed@example.invalid"
        await self.db.commit()
        await trigger_sos(SOSAlertRequest(), "sender", self.db)
        self.email.assert_not_called()

    async def test_only_recipient_can_revoke_and_it_blocks_subsequent_alerts(self):
        await self.accept()
        with self.assertRaises(HTTPException): await revoke_consent(self.contact.id, "stranger", self.db)
        await revoke_consent(self.contact.id, "recipient", self.db)
        await self.db.commit()
        self.assertEqual(await accepted_contacts("recipient", self.db), [])
        self.assertFalse((await trigger_sos(SOSAlertRequest(), "sender", self.db)).success)
        self.email.assert_not_called()
        self.push.assert_not_called()

    async def test_edit_identity_resets_consent_and_invalidates_pending_link(self):
        await self.accept()
        updated = await update_contact(self.contact.id, EmergencyContactUpdate(phone="+919111111111"), "sender", self.db)
        await self.db.commit()
        self.assertEqual(updated.consent_status, "pending")
        self.assertIsNone(updated.accepted_by)
        token = await self.invite()
        await update_contact(self.contact.id, EmergencyContactUpdate(email="new@example.invalid"), "sender", self.db)
        await self.db.commit()
        with self.assertRaises(HTTPException): await preview_invitation(InvitationToken(token=token), self.db)
        self.assertFalse((await trigger_sos(SOSAlertRequest(), "sender", self.db)).success)

    async def test_delete_cascades_consent(self):
        await self.accept()
        await delete_contact(self.contact.id, "sender", self.db)
        await self.db.commit()
        result = await self.db.execute(select(EmergencyContactConsent).where(EmergencyContactConsent.contact_id == self.contact.id))
        self.assertIsNone(result.scalar_one_or_none())

    async def test_outbound_failure_preserves_saved_inbox_and_reports_failure(self):
        await self.accept()
        self.email.return_value = (False, "secret provider error")
        self.push.side_effect = RuntimeError("secret push error")
        result = await trigger_sos(SOSAlertRequest(), "sender", self.db)
        self.assertTrue(result.success)
        self.assertEqual(len(await received_alerts("recipient", self.db)), 1)
        self.assertTrue(any("could not be delivered" in action for action in result.actions))
        self.assertNotIn("secret", str(result))

    async def test_sos_repeat_is_limited_without_duplicate_deliveries(self):
        await self.accept()
        await trigger_sos(SOSAlertRequest(), "sender", self.db)
        with self.assertRaises(HTTPException) as error:
            await trigger_sos(SOSAlertRequest(is_silent=True), "sender", self.db)
        self.assertEqual(error.exception.status_code, 429)
        self.email.assert_called_once()
        self.assertEqual(len(await received_alerts("recipient", self.db)), 1)

    async def test_duplicate_contacts_for_one_recipient_send_once(self):
        await self.accept()
        second = await create_contact(EmergencyContactCreate(name="Second", phone="+919222222222"), "sender", self.db)
        self.contact = second
        await self.accept()
        await trigger_sos(SOSAlertRequest(), "sender", self.db)
        self.email.assert_called_once()
        self.push.assert_called_once()
        self.assertEqual(len(await received_alerts("recipient", self.db)), 1)


if __name__ == "__main__":
    unittest.main()
