"""Dashboard regression coverage with an isolated database."""
import unittest
from datetime import date, time

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.database import Base
from app.models.user import User, UserProfile
from app.models.medicine import Medicine
from app.models.appointment import Appointment
from app.routers.dashboard import get_dashboard_summary


class DashboardTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.db = async_sessionmaker(self.engine, expire_on_commit=False)()
        self.db.add(User(id='dashboard-user', email='dashboard@example.invalid', hashed_password='unused'))
        self.db.add(UserProfile(user_id='dashboard-user', name='Saved Profile', height=170, weight=70))
        await self.db.commit()

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    async def test_existing_profile_and_empty_dashboard(self):
        summary = await get_dashboard_summary('dashboard-user', self.db)
        self.assertEqual(summary.user_name, 'Saved Profile')
        self.assertEqual(summary.bmi, 24.2)
        self.assertEqual(summary.health_score, 85)
        self.assertEqual(summary.active_medicines, 0)
        self.assertEqual(summary.upcoming_appointments, 0)

    async def test_health_score_uses_medicines_and_appointments(self):
        self.db.add(Medicine(user_id='dashboard-user', name='Test', dosage='1 tablet', times=['08:00'], is_active=True))
        self.db.add(Appointment(user_id='dashboard-user', doctor='Test Doctor', specialty='General',
                                hospital='Test Clinic', date=date.today(), time=time(12), status='upcoming'))
        await self.db.commit()
        summary = await get_dashboard_summary('dashboard-user', self.db)
        self.assertEqual(summary.health_score, 95)
        self.assertEqual(summary.active_medicines, 1)
        self.assertEqual(summary.upcoming_appointments, 1)
        self.assertEqual(summary.reminders[0]['name'], 'Test')
