"""
LifeOS Backend — Background Scheduler for Notifications
"""
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.medicine import Medicine, MedicineLog
from app.models.user import UserProfile
from app.utils.push import send_push_notification

logger = logging.getLogger("lifeos.scheduler")

async def check_medications_loop():
    """
    Infinite loop to check medications every minute.
    """
    logger.info("Medication scheduler started.")
    while True:
        try:
            await check_and_send_medication_reminders()
        except Exception as e:
            logger.error(f"Error in medication scheduler loop: {e}")
        
        # Calculate time until next exact minute
        now = datetime.now()
        sleep_seconds = 60 - now.second
        await asyncio.sleep(sleep_seconds)

async def check_and_send_medication_reminders():
    """
    Checks if any active medicine needs to be taken at the current time and sends a push notification.
    """
    async with AsyncSessionLocal() as db:
        now_utc = datetime.now(timezone.utc)
        # Using server's local time for simplicity as requested
        now_local = datetime.now()
        current_time_str = now_local.strftime("%H:%M")
        today_date = now_local.date()
        
        # Query active medicines
        meds_res = await db.execute(select(Medicine).where(Medicine.is_active == True))
        active_meds = meds_res.scalars().all()
        
        logger.info(f"Scheduler checking {len(active_meds)} active medicines at {current_time_str}")
        
        for med in active_meds:
            if not med.times:
                continue
                
            if current_time_str in med.times:
                logger.info(f"Medicine {med.name} is scheduled for {current_time_str}! Checking logs...")
                # Check if a log already exists for this exact time and date
                log_res = await db.execute(
                    select(MedicineLog).where(
                        MedicineLog.medicine_id == med.id,
                        MedicineLog.date == today_date,
                        MedicineLog.scheduled_time == current_time_str
                    )
                )
                existing_log = log_res.scalar_one_or_none()
                
                if not existing_log:
                    # Get user profile for push token
                    profile_res = await db.execute(
                        select(UserProfile).where(UserProfile.user_id == med.user_id)
                    )
                    profile = profile_res.scalar_one_or_none()
                    
                    if profile and profile.push_device_token:
                        title = f"Medication Reminder: {med.name}"
                        message = f"It's {current_time_str}. Please take your {med.dosage} of {med.name}."
                        logger.info(f"Sending push notification to user {med.user_id} for {med.name}")
                        send_push_notification(profile.push_device_token, title, message)
                        
                        # Optionally, we could create an 'unanswered' MedicineLog here to avoid duplicate pushes
                        # But since this function only runs once per minute, it won't duplicate.
