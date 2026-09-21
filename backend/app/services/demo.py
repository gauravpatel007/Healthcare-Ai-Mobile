import logging
# pyrefly: ignore [missing-import]
from sqlalchemy import select
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import make_transient
from app.database import generate_uuid

# Models
from app.models.user import UserProfile
from app.models.emergency import EmergencyContact
from app.models.medicine import Medicine, MedicineDose
from app.models.chat import ChatMessage
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.health_tracker import HealthEntry, SleepEntry, WaterLog
from app.models.gamification import UserGamification
from app.models.mood import MoodEntry, JournalEntry
from app.models.expense import MedicalExpense

logger = logging.getLogger("lifeos.demo")

async def clone_demo_user_data(db: AsyncSession, template_uid: str, new_uid: str):
    try:
        # 1. Profile
        try:
            profile_res = await db.execute(select(UserProfile).where(UserProfile.user_id == template_uid))
            profile = profile_res.scalar_one_or_none()
            if profile:
                db.expunge(profile)
                make_transient(profile)
                profile.id = generate_uuid()
                profile.user_id = new_uid
                db.add(profile)
        except Exception as e:
            logger.warning(f"Demo clone profile warning: {e}")
            
        # 2. Emergency Contacts
        try:
            contacts_res = await db.execute(select(EmergencyContact).where(EmergencyContact.user_id == template_uid))
            for contact in contacts_res.scalars().all():
                db.expunge(contact)
                make_transient(contact)
                contact.id = generate_uuid()
                contact.user_id = new_uid
                contact.verification_token_hash = None
                contact.telegram_chat_id = None
                db.add(contact)
        except Exception as e:
            logger.warning(f"Demo clone emergency contacts warning: {e}")
            
        # 3. Chat Messages
        try:
            chats_res = await db.execute(select(ChatMessage).where(ChatMessage.user_id == template_uid))
            for chat in chats_res.scalars().all():
                db.expunge(chat)
                make_transient(chat)
                chat.id = generate_uuid()
                chat.user_id = new_uid
                db.add(chat)
        except Exception as e:
            logger.warning(f"Demo clone chat warning: {e}")
            
        # 4. Appointments
        try:
            appts_res = await db.execute(select(Appointment).where(Appointment.user_id == template_uid))
            for appt in appts_res.scalars().all():
                db.expunge(appt)
                make_transient(appt)
                appt.id = generate_uuid()
                appt.user_id = new_uid
                db.add(appt)
        except Exception as e:
            logger.warning(f"Demo clone appointments warning: {e}")
            
        # 5. Medicines & Doses
        try:
            meds_res = await db.execute(select(Medicine).where(Medicine.user_id == template_uid))
            for med in meds_res.scalars().all():
                old_med_id = med.id
                db.expunge(med)
                make_transient(med)
                med.id = generate_uuid()
                med.user_id = new_uid
                db.add(med)
                
                doses_res = await db.execute(select(MedicineDose).where(MedicineDose.medicine_id == old_med_id))
                for dose in doses_res.scalars().all():
                    db.expunge(dose)
                    make_transient(dose)
                    dose.id = generate_uuid()
                    dose.medicine_id = med.id
                    dose.user_id = new_uid
                    db.add(dose)
        except Exception as e:
            logger.warning(f"Demo clone medicines warning: {e}")
                
        # 6. Medical Records
        try:
            med_records_res = await db.execute(select(MedicalRecord).where(MedicalRecord.user_id == template_uid))
            for record in med_records_res.scalars().all():
                db.expunge(record)
                make_transient(record)
                record.id = generate_uuid()
                record.user_id = new_uid
                db.add(record)
        except Exception as e:
            logger.warning(f"Demo clone medical records warning: {e}")

        # 7. Health Entries, Sleep Entries, Water Logs
        try:
            health_res = await db.execute(select(HealthEntry).where(HealthEntry.user_id == template_uid))
            for item in health_res.scalars().all():
                db.expunge(item)
                make_transient(item)
                item.id = generate_uuid()
                item.user_id = new_uid
                db.add(item)

            sleep_res = await db.execute(select(SleepEntry).where(SleepEntry.user_id == template_uid))
            for item in sleep_res.scalars().all():
                db.expunge(item)
                make_transient(item)
                item.id = generate_uuid()
                item.user_id = new_uid
                db.add(item)

            water_res = await db.execute(select(WaterLog).where(WaterLog.user_id == template_uid))
            for item in water_res.scalars().all():
                db.expunge(item)
                make_transient(item)
                item.id = generate_uuid()
                item.user_id = new_uid
                db.add(item)
        except Exception as e:
            logger.warning(f"Demo clone health trackers warning: {e}")

        # 8. Gamification
        try:
            gamify_res = await db.execute(select(UserGamification).where(UserGamification.user_id == template_uid))
            gamify = gamify_res.scalar_one_or_none()
            if gamify:
                db.expunge(gamify)
                make_transient(gamify)
                gamify.id = generate_uuid()
                gamify.user_id = new_uid
                db.add(gamify)
        except Exception as e:
            logger.warning(f"Demo clone gamification warning: {e}")

        # 9. Mood & Journal Entries
        try:
            mood_res = await db.execute(select(MoodEntry).where(MoodEntry.user_id == template_uid))
            for item in mood_res.scalars().all():
                db.expunge(item)
                make_transient(item)
                item.id = generate_uuid()
                item.user_id = new_uid
                db.add(item)

            journal_res = await db.execute(select(JournalEntry).where(JournalEntry.user_id == template_uid))
            for item in journal_res.scalars().all():
                db.expunge(item)
                make_transient(item)
                item.id = generate_uuid()
                item.user_id = new_uid
                db.add(item)
        except Exception as e:
            logger.warning(f"Demo clone mood/journal warning: {e}")

        # 10. Medical Expenses
        try:
            expense_res = await db.execute(select(MedicalExpense).where(MedicalExpense.user_id == template_uid))
            for item in expense_res.scalars().all():
                db.expunge(item)
                make_transient(item)
                item.id = generate_uuid()
                item.user_id = new_uid
                db.add(item)
        except Exception as e:
            logger.warning(f"Demo clone medical expenses warning: {e}")
                
        # Commit all cloned data
        await db.commit()
        logger.info(f"Successfully cloned demo data from {template_uid} to {new_uid}")
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to clone demo data: {e}")
        raise e
