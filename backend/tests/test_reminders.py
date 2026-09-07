"""Run: python -m unittest discover -s tests -p test_reminders.py -v
Uses an isolated in-memory SQLite database; never touches application data.
"""
import unittest
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from fastapi import HTTPException
from app.database import Base
from app.models.user import User
from app.models.medicine import Medicine, MedicineLog
from app.models.reminder import ReminderSettings, MedicineDose, ReminderAction, ReminderNotice
from app.services.reminders import occurs, scheduled_instant, materialize, dose_status, refill_notices
from app.routers.reminders import act, refill, DoseInput, RefillInput, read_notice, SettingsInput
from app.schemas.medicine import MedicineCreate

UTC = timezone.utc


class CalendarTests(unittest.TestCase):
    def test_dst_and_india(self):
        self.assertEqual(scheduled_instant(date(2026, 9, 6), '08:00', 'Asia/Kolkata').hour, 2)
        self.assertEqual(scheduled_instant(date(2026, 3, 8), '02:30', 'America/New_York'), datetime(2026, 3, 8, 7, 30, tzinfo=UTC))
        self.assertEqual(scheduled_instant(date(2026, 11, 1), '01:30', 'America/New_York'), datetime(2026, 11, 1, 5, 30, tzinfo=UTC))

    def test_weekly_and_boundaries(self):
        med = Medicine(is_active=True, frequency='once_weekly', start_date=date(2026, 9, 1), end_date=date(2026, 9, 15))
        self.assertTrue(occurs(med, date(2026, 9, 8)))
        self.assertFalse(occurs(med, date(2026, 9, 9)))
        self.assertFalse(occurs(med, date(2026, 9, 22)))
        med.frequency = 'as_needed'
        self.assertFalse(occurs(med, date(2026, 9, 8)))

    def test_snooze_expiry(self):
        now = datetime.now(UTC)
        dose = MedicineDose(status='snoozed', scheduled_at=now - timedelta(hours=3), snoozed_until=now + timedelta(minutes=15))
        settings = ReminderSettings(grace_minutes=120)
        self.assertEqual(dose_status(dose, settings, now), 'snoozed')
        self.assertEqual(dose_status(dose, settings, now + timedelta(hours=3)), 'missed')

    def test_invalid_timezone(self):
        with self.assertRaises(ValueError): SettingsInput(timezone='not/a-zone')

    def test_invalid_or_duplicate_schedule_times(self):
        for times in [['25:00'], ['08:00', '08:00'], ['8am']]:
            with self.assertRaises(ValueError): MedicineCreate(name='Test', times=times)


class ActionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        async with self.engine.begin() as conn:
            tables = [User.__table__, Medicine.__table__, MedicineLog.__table__, ReminderSettings.__table__,
                      MedicineDose.__table__, ReminderAction.__table__, ReminderNotice.__table__]
            await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        self.now = datetime.now(UTC)
        self.db.add(User(id='u', email='test@example.invalid', hashed_password='unused'))
        self.settings = ReminderSettings(user_id='u', timezone='Asia/Kolkata', created_at=self.now - timedelta(days=2),
                                         overrides={}, grace_minutes=120)
        self.med = Medicine(id='m', user_id='u', name='Test medicine', dosage='1 tablet', type='tablet',
            times=['08:00'], frequency='once_daily', start_date=self.now.date() - timedelta(days=5),
            remaining=10, total_pills=10, is_active=True)
        self.dose = MedicineDose(id='m:2026-09-06:08:00', user_id='u', medicine_id='m', name='Test medicine',
            dosage='1 tablet', scheduled_at=self.now - timedelta(minutes=10), timezone='Asia/Kolkata',
            local_date='2026-09-06', local_time='08:00', status='pending', stock_used=0)
        self.db.add_all([self.settings, self.med, self.dose])
        await self.db.commit()

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    def action(self, status, number=1, **extra):
        return DoseInput(action_id=f'action-number-{number:04d}', status=status, occurred_at=self.now + timedelta(seconds=number), **extra)

    async def test_taken_retry_correction_stock(self):
        data = self.action('taken')
        await act(self.dose.id, data, 'u', self.db)
        await act(self.dose.id, data, 'u', self.db)
        self.assertEqual(self.med.remaining, 9)
        await act(self.dose.id, self.action('taken', 2), 'u', self.db)
        self.assertEqual(self.med.remaining, 9)
        await act(self.dose.id, self.action('skipped', 3), 'u', self.db)
        self.assertEqual(self.med.remaining, 10)

    async def test_older_offline_action_cannot_overwrite(self):
        await act(self.dose.id, self.action('skipped', 2), 'u', self.db)
        await act(self.dose.id, self.action('taken', 1), 'u', self.db)
        self.assertEqual(self.dose.status, 'skipped')
        self.assertEqual(self.med.remaining, 10)

    async def test_snooze_and_ownership(self):
        await act(self.dose.id, self.action('snoozed', minutes=30), 'u', self.db)
        self.assertEqual(self.dose.snoozed_until, self.now + timedelta(seconds=1, minutes=30))
        self.assertEqual(self.med.remaining, 10)
        self.db.add(User(id='other', email='other@example.invalid', hashed_password='unused'))
        await self.db.commit()
        with self.assertRaises(HTTPException) as error:
            await act(self.dose.id, self.action('taken', 2), 'other', self.db)
        self.assertEqual(error.exception.status_code, 404)

    async def test_refill_and_notice_deduplication(self):
        self.med.remaining = 3
        await refill_notices(self.db, self.settings, [self.med])
        await self.db.flush()
        notice = await self.db.get(ReminderNotice, 'refill:m')
        await read_notice(notice.id, 'u', self.db)
        await refill_notices(self.db, self.settings, [self.med])
        self.assertTrue(notice.read)
        data = RefillInput(action_id='refill-unique-action', quantity=30)
        await refill('m', data, 'u', self.db)
        await refill('m', data, 'u', self.db)
        self.assertEqual(self.med.remaining, 33)
        self.assertIsNone(await self.db.get(ReminderNotice, 'refill:m'))

    async def test_schedule_edits_cancel_future_only(self):
        _, doses = await materialize(self.db, self.settings, self.now)
        await self.db.commit()
        upcoming = [d for d in doses if d.medicine_id == 'm' and d.scheduled_at.replace(tzinfo=UTC) > self.now]
        self.assertTrue(upcoming)
        self.med.times = ['09:00']
        await materialize(self.db, self.settings, self.now)
        self.assertTrue(all(d.status == 'cancelled' for d in upcoming))

    async def test_empty_stock_does_not_block_log(self):
        self.med.remaining = 0
        await act(self.dose.id, self.action('taken'), 'u', self.db)
        self.assertEqual(self.med.remaining, 0)
        await act(self.dose.id, self.action('pending', 2), 'u', self.db)
        self.assertEqual(self.med.remaining, 0)

    async def test_http_summary_serializes_saved_medicines(self):
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport
        from app.routers.reminders import router
        from app.database import get_db
        from app.dependencies import get_current_user_id
        application = FastAPI()
        application.include_router(router)
        application.dependency_overrides[get_current_user_id] = lambda: 'u'
        async def session(): yield self.db
        application.dependency_overrides[get_db] = session
        async with AsyncClient(transport=ASGITransport(app=application), base_url='http://test') as client:
            response = await client.get('/reminders?timezone=Asia/Kolkata')
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['medicines'][0]['name'], 'Test medicine')
            self.assertTrue(response.json()['rules'])
if __name__ == '__main__': unittest.main()
