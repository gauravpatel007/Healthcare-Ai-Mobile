"""Deliver SOS only to accounts that explicitly accepted an invitation."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from html import escape

# pyrefly: ignore [missing-import]
from fastapi import HTTPException
# pyrefly: ignore [missing-import]
from sqlalchemy import select

from app.models.emergency import EmergencyContact, EmergencyContactConsent, SOSLog
from app.models.notification import SystemNotification
from app.models.user import User, UserProfile
from app.schemas.emergency import SOSAlertResponse
from app.utils.email import send_sos_email
from app.utils.push import send_push_notification

logger = logging.getLogger("lifeos.emergency")


async def dispatch_consented_sos(request, user_id, db):
    # Serialize triggers for the same sender across workers, including silent SOS.
    sender = (await db.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one_or_none()
    if not sender or not sender.is_active or sender.is_deleted:
        raise HTTPException(403, "An active account is required.")
    now = datetime.now(timezone.utc)
    recent = (await db.execute(select(SOSLog.id).where(
        SOSLog.user_id == user_id, SOSLog.created_at > now - timedelta(seconds=60)
    ).limit(1))).first()
    if recent:
        raise HTTPException(429, "SOS was already submitted in the last minute. Call your contact directly if help is urgent.")
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))).scalar_one_or_none()
    sender_name = profile.name if profile else "LifeOS user"
    location_url = (f"https://www.google.com/maps?q={request.latitude},{request.longitude}"
                    if request.latitude is not None and request.longitude is not None else None)
    # Fetch all emergency contacts for the user, regardless of verification or consent status.
    contacts = (await db.execute(select(EmergencyContact).where(
        EmergencyContact.user_id == user_id
    ).with_for_update())).scalars().all()
    
    db.add(SOSLog(user_id=user_id, is_silent=request.is_silent))
    message = f"{sender_name} triggered an SOS alert. Please contact them immediately."
    message += f" Location: {location_url}" if location_url else " Location was not available."
    
    await db.commit()
    
    if not contacts:
        return SOSAlertResponse(success=False,
            message="No emergency contacts found.",
            actions=["Add an emergency contact to send SOS alerts. Call someone directly if help is urgent."])

    actions = []
    tasks = []
    
    email_contacts = [c.email for c in contacts if c.email]
    call_contacts = [c.phone for c in contacts if getattr(c, 'telegram_verified', False)]
    
    if email_contacts:
        tasks.append(("Email", asyncio.to_thread(send_sos_email, email_contacts, escape(sender_name), location_url)))
        
    if call_contacts:
        from app.utils.email import send_sos_call_twilio
        tasks.append(("Call", asyncio.to_thread(send_sos_call_twilio, call_contacts, escape(sender_name), location_url, None)))
            
    mail_sent = False
    call_done = False
    
    if tasks:
        results = await asyncio.gather(*(task for _, task in tasks), return_exceptions=True)
        for (channel, _), result in zip(tasks, results):
            if isinstance(result, tuple) and result[0]:
                if channel == "Email":
                    mail_sent = True
                elif channel == "Call":
                    call_done = True
            else:
                logger.warning("SOS %s delivery failed: %s", channel, result)
                
    actions.append("CUSTOM_UI_MSG")
    
    if email_contacts:
        actions.append("1. Mail sent to your emergency contact with your location")
        
    if call_contacts:
        if call_done:
            actions.append("2. SOS call delivery is done")
        else:
            actions.append(f"2. SOS call delivery is not done - {result[1]}")
                
    return SOSAlertResponse(success=True,
        message="SOS alerts processed.", actions=actions)
