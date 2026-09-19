import json
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.database import Base
from app.models.user import User, UserProfile
from app.models.medicine import Medicine
from app.models.reminder import ReminderSettings, MedicineDose
from app.services.scheduler import check_and_send_medication_reminders
from app.routers.users import update_device_token, DeviceTokenUpdate
from app.utils.push import send_push_notification


class ProviderTests(unittest.TestCase):
    def test_payload_and_empty_provider_response(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({'id': ''}).encode()
        settings = SimpleNamespace(ONESIGNAL_APP_ID='app', ONESIGNAL_REST_API_KEY='key')
        with patch('app.utils.push.get_settings', return_value=settings), patch('app.utils.push.urllib.request.urlopen', return_value=response) as send:
            ok, message = send_push_notification('phone', 'Reminder', 'Test', data={'href':'/app/medicine?tab=reminders'}, ttl=60)
            self.assertFalse(ok)
            self.assertIn('subscription', message)
            payload = json.loads(send.call_args.args[0].data)
            self.assertEqual(payload['include_subscription_ids'], ['phone'])
            self.assertEqual(payload['ttl'], 60)
            self.assertEqual(payload['priority'], 10)


class DeliveryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.now = datetime.now(timezone.utc)
        async with self.sessions() as db:
            db.add(User(id='u', email='test@example.invalid', hashed_password='unused'))
            db.add(UserProfile(user_id='u', push_device_token='old-phone'))
            db.add(ReminderSettings(user_id='u', timezone='UTC', enabled=True, delivery='server',
                                   grace_minutes=120, overrides={}, created_at=self.now-timedelta(days=1)))
            db.add(Medicine(id='med', user_id='u', name='Test medicine', dosage='1 tablet',
                times=[self.now.strftime('%H:%M')], start_date=self.now.date(), remaining=20, total_pills=20, is_active=True))
            await db.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def run_scheduler(self, success=True):
        with patch('app.services.scheduler.AsyncSessionLocal', self.sessions), \
             patch('app.services.scheduler.send_push_notification', return_value=(success, 'result')) as push:
            await check_and_send_medication_reminders()
            return push

    async def test_due_push_runs_without_app_and_is_not_repeated(self):
        push = await self.run_scheduler()
        self.assertEqual(push.call_count, 1)
        self.assertEqual(push.call_args.kwargs['data']['type'], 'medicine_reminder')
        self.assertEqual((await self.run_scheduler()).call_count, 0)

    async def test_failure_is_not_marked_sent_and_retries(self):
        self.assertEqual((await self.run_scheduler(False)).call_count, 1)
        self.assertEqual((await self.run_scheduler()).call_count, 1)

    async def test_future_disabled_and_device_delivery_do_not_send(self):
        async with self.sessions() as db:
            med = await db.get(Medicine, 'med')
            med.times = [(self.now + timedelta(minutes=2)).strftime('%H:%M')]
            await db.commit()
        self.assertEqual((await self.run_scheduler()).call_count, 0)
        for enabled, delivery in [(False, 'server'), (True, 'device')]:
            async with self.sessions() as db:
                s = await db.get(ReminderSettings, 'u'); s.enabled=enabled; s.delivery=delivery
                med=await db.get(Medicine,'med'); med.times=[self.now.strftime('%H:%M')]
                await db.commit()
            self.assertEqual((await self.run_scheduler()).call_count, 0)

    async def test_registration_refreshes_timezone_without_enabling_opt_out(self):
        await self.run_scheduler(False)
        async with self.sessions() as db:
            s=await db.get(ReminderSettings,'u'); s.enabled=False
            await db.commit()
            await update_device_token(DeviceTokenUpdate(token='new-phone', timezone='Asia/Kolkata'), 'u', db)
            self.assertFalse(s.enabled)
            self.assertEqual(s.timezone, 'Asia/Kolkata')
            doses=(await db.execute(select(MedicineDose))).scalars().all()
            self.assertTrue(all(d.push_attempts == 0 for d in doses))
