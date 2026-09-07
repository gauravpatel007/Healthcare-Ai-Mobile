"""Add reminder tables without changing or deleting existing medicine data.
Run from backend: python migrate_reminders.py
Development startup also creates these registered tables via init_db().
"""
import asyncio
from app.database import engine, Base
import app.models
from app.models.reminder import ReminderSettings, MedicineDose, ReminderAction, ReminderNotice

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=[
            ReminderSettings.__table__, MedicineDose.__table__, ReminderAction.__table__, ReminderNotice.__table__]))
        from sqlalchemy import text
        await conn.execute(text("ALTER TABLE medicine_reminder_notices ADD COLUMN IF NOT EXISTS push_sent BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE medicine_reminder_notices ADD COLUMN IF NOT EXISTS push_attempts INTEGER NOT NULL DEFAULT 0"))
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
