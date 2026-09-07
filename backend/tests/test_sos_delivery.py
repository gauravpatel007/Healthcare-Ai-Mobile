"""Run with unittest; DB calls and all notifications are mocked. No alerts sent."""
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

os.environ['DATABASE_URL'] = 'postgresql+asyncpg://test:test@127.0.0.1:1/test'
from app.routers import emergency
from app.schemas.emergency import SOSAlertRequest


class SOSDeliveryTests(unittest.IsolatedAsyncioTestCase):
    async def run_alert(self, contacts, sms_result, call_result):
        db = MagicMock()
        rows = MagicMock()
        rows.scalars.return_value.all.return_value = contacts
        profile = MagicMock()
        profile.scalar_one_or_none.return_value = SimpleNamespace(name='Test User')
        clip = MagicMock()
        clip.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(side_effect=[rows, profile, clip])
        db.commit = AsyncMock()
        with patch.object(emergency, 'send_sos_email', return_value=False), \
             patch.object(emergency, 'send_sos_sms_twilio', return_value=sms_result), \
             patch.object(emergency, 'send_sos_call_twilio', return_value=call_result):
            return await emergency.trigger_sos(SOSAlertRequest(is_silent=True), 'test-user', db)

    async def test_missing_provider_configuration_is_not_success(self):
        contact = SimpleNamespace(email=None, phone='+910000000000')
        result = await self.run_alert([contact], (False, 'Twilio configuration missing'), (False, 'Twilio configuration missing'))
        self.assertFalse(result.success)
        self.assertTrue(all('failed' in action.lower() for action in result.actions))

    async def test_no_contacts_is_not_success(self):
        result = await self.run_alert([], (False, ''), (False, ''))
        self.assertFalse(result.success)
        self.assertIn('could not be delivered', result.actions[0])

    async def test_partial_acceptance_preserves_failed_channel(self):
        contact = SimpleNamespace(email=None, phone='+910000000000')
        result = await self.run_alert([contact], (True, 'SMS requests accepted: 1.'), (False, 'Call rejected'))
        self.assertTrue(result.success)
        self.assertIn('delivery is not confirmed', result.message)
        self.assertIn('Notification failed: Call rejected', result.actions)


if __name__ == '__main__':
    unittest.main()
