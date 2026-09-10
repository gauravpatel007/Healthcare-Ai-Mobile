"""Run with unittest; DB calls and all notifications are mocked. No alerts sent."""
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

os.environ['DATABASE_URL'] = 'postgresql+asyncpg://test:test@127.0.0.1:1/test'
from app.routers import emergency
from app.schemas.emergency import SOSAlertRequest
from pydantic import ValidationError
from app.config import Settings
from app.utils.email import send_sos_call_twilio


class SOSDeliveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_endpoint_passes_profile_and_coordinates_to_call_provider(self):
        db = MagicMock()
        contacts = MagicMock()
        contacts.scalars.return_value.all.return_value = [SimpleNamespace(phone='+919725259773', email=None)]
        profile = MagicMock()
        profile.scalar_one_or_none.return_value = SimpleNamespace(name='Gaurav Patel')
        clip = MagicMock()
        clip.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(side_effect=[contacts, profile, clip])
        db.commit = AsyncMock()
        config = Settings(_env_file=None, TWILIO_ACCOUNT_SID='AC' + 'a' * 32,
                          TWILIO_AUTH_TOKEN='b' * 32, TWILIO_FROM_NUMBER='+15005550006',
                          TWILIO_SMS_TEMPLATE_ONLY=False)
        client = MagicMock()
        client.calls.create.return_value.status = 'queued'
        with patch.object(emergency, 'send_sos_call_twilio', side_effect=send_sos_call_twilio), \
             patch('app.utils.email.get_settings', return_value=config), \
             patch('app.utils.twilio_support.create_client', return_value=client):
            result = await emergency.trigger_sos(SOSAlertRequest(latitude=23.0207834, longitude=72.4622436), 'test-user', db)
        self.assertTrue(result.success)
        self.assertNotIn("text message", client.calls.create.call_args.kwargs['twiml'])
        db.commit.assert_awaited_once()

    def test_location_requires_a_valid_coordinate_pair(self):
        for values in ({'latitude': 23}, {'longitude': 72}, {'latitude': 91, 'longitude': 72},
                       {'latitude': float('nan'), 'longitude': 72}, {'accuracy': -1}):
            with self.assertRaises(ValidationError):
                SOSAlertRequest(**values)
        self.assertEqual(SOSAlertRequest(latitude=0, longitude=0).latitude, 0)
        self.assertIsNone(SOSAlertRequest().latitude)

    async def run_alert(self, contacts, call_result):
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
             patch.object(emergency, 'send_sos_call_twilio', return_value=call_result):
            return await emergency.trigger_sos(SOSAlertRequest(is_silent=True), 'test-user', db)

    async def test_missing_provider_configuration_is_not_success(self):
        contact = SimpleNamespace(email=None, phone='+910000000000')
        result = await self.run_alert([contact], (False, 'Twilio configuration missing'))
        self.assertFalse(result.success)
        self.assertTrue(all('failed' in action.lower() for action in result.actions))

    async def test_no_contacts_is_not_success(self):
        result = await self.run_alert([], (False, ''))
        self.assertFalse(result.success)
        self.assertIn('could not be delivered', result.actions[0])

    async def test_partial_acceptance_preserves_failed_channel(self):
        contact = SimpleNamespace(email=None, phone='+910000000000')
        result = await self.run_alert([contact], (False, 'Call rejected'))
        self.assertFalse(result.success)
        self.assertIn('Notification failed: Call rejected', result.actions[0])


if __name__ == '__main__':
    unittest.main()
