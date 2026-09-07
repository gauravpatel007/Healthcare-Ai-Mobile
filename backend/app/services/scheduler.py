"""Persistent reminder delivery. User locks prevent concurrent worker duplicates."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.reminder import ReminderSettings, ReminderNotice
from app.models.user import UserProfile
from app.services.reminders import settings_for, materialize, refill_notices, aware
from app.utils.push import send_push_notification

logger = logging.getLogger("lifeos.scheduler")


async def check_medications_loop():
    while True:
        try:
            await check_and_send_medication_reminders()
        except Exception:
            logger.exception("Medication reminder check failed")
        await asyncio.sleep(30)


async def check_and_send_medication_reminders():
    async with AsyncSessionLocal() as db:
        users = list((await db.execute(select(ReminderSettings.user_id))).scalars())
    for user_id in users:
        try:
            async with AsyncSessionLocal() as db:
                settings = await settings_for(db, user_id)
                meds, doses = await materialize(db, settings)
                await refill_notices(db, settings, meds)
                now = datetime.now(timezone.utc)
                profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))).scalar_one_or_none()
                if settings.enabled and settings.delivery == "server" and profile and profile.push_device_token:
                    notices = (await db.execute(select(ReminderNotice).where(ReminderNotice.user_id == user_id,
                        ReminderNotice.id.like("refill:%"), ReminderNotice.push_sent == False,
                        ReminderNotice.push_attempts < 3))).scalars().all()
                    for notice in notices:
                        notice.push_attempts += 1
                        success, _ = await asyncio.to_thread(send_push_notification, profile.push_device_token, notice.title, notice.message)
                        notice.push_sent = success
                for dose in doses:
                    due = aware(dose.snoozed_until or dose.scheduled_at)
                    if dose.status not in ("pending", "snoozed") or due > now:
                        continue
                    notice_id = f"dose:{dose.id}"
                    if not await db.get(ReminderNotice, notice_id):
                        db.add(ReminderNotice(id=notice_id, user_id=user_id, title=f"Medicine: {dose.name}",
                            message=f"{dose.dosage} · Scheduled {dose.local_time} ({dose.timezone}). Record your dose in Reminders."))
                    if (not settings.enabled or settings.delivery == "device" or dose.notified_at or
                            dose.push_attempts >= 3 or now > due + timedelta(minutes=settings.grace_minutes)):
                        continue
                    if profile and profile.push_device_token:
                        dose.push_attempts += 1
                        success, _ = await asyncio.to_thread(send_push_notification,
                            profile.push_device_token, f"Medicine reminder: {dose.name}",
                            f"{dose.dosage} · Open LifeOS to mark taken, skip or snooze.")
                        if success:
                            dose.notified_at = now
                await db.commit()
        except Exception:
            logger.exception("Reminder delivery failed for one account")
