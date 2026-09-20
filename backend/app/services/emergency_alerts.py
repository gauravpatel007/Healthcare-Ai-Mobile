"""Deliver SOS only to accounts that explicitly accepted an invitation."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from html import escape

from fastapi import HTTPException
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
    recipients = (await db.execute(select(EmergencyContactConsent, User, UserProfile).join(
        EmergencyContact, EmergencyContact.id == EmergencyContactConsent.contact_id
    ).join(User, User.id == EmergencyContactConsent.recipient_user_id).outerjoin(
        UserProfile, UserProfile.user_id == User.id
    ).where(
        EmergencyContact.user_id == user_id, EmergencyContactConsent.status == "accepted",
        User.id != user_id, User.is_active.is_(True), User.is_deleted.is_(False), User.is_verified.is_(True),
    ))).all()
    # The same account may have accepted multiple contacts; send only once.
    unique = {}
    for consent, recipient, recipient_profile in recipients:
        previous = unique.get(recipient.id)
        email_allowed = consent.email_opt_in and consent.recipient_email == recipient.email
        unique[recipient.id] = (recipient, recipient_profile, email_allowed or bool(previous and previous[2]))
    db.add(SOSLog(user_id=user_id, is_silent=request.is_silent))
    message = f"{sender_name} triggered an SOS alert. Please contact them immediately."
    message += f" Location: {location_url}" if location_url else " Location was not available."
    for recipient_id in unique:
        db.add(SystemNotification(type="SOS", target_audience=recipient_id, title="Emergency SOS alert",
                                  message=message, status="Sent"))
    # Persist the alert inbox before any best-effort network request.
    await db.commit()
    if not unique:
        return SOSAlertResponse(success=False,
            message="SOS recorded. No accepted emergency contacts are available. Call someone directly.",
            actions=["No accepted emergency contacts. Share an invitation and ask your contact to accept first."])

    actions = [f"In-app alerts saved: {len(unique)}. Recipients may not have seen them yet."]
    tasks = []
    for recipient, recipient_profile, email_allowed in unique.values():
        if email_allowed:
            # Use the verified recipient account, NEVER sender-entered contact.email.
            tasks.append(("Email", asyncio.to_thread(send_sos_email, [recipient.email], escape(sender_name), location_url)))
        if recipient_profile and recipient_profile.push_device_token:
            tasks.append(("Push", asyncio.to_thread(send_push_notification,
                recipient_profile.push_device_token, "Emergency SOS alert", f"{sender_name} needs your help. Open LifeOS for details.",
                data={"href": "/emergency-invitation", "type": "sos"}, ttl=3600)))
    if tasks:
        results = await asyncio.gather(*(task for _, task in tasks), return_exceptions=True)
        for (channel, _), result in zip(tasks, results):
            if isinstance(result, tuple) and result[0]:
                actions.append(f"{channel} request accepted. Delivery is not confirmed.")
            else:
                logger.warning("SOS %s delivery was not accepted", channel)
                actions.append(f"{channel} could not be delivered. The alert remains in the recipient's app inbox.")
    return SOSAlertResponse(success=True,
        message="SOS saved in accepted contacts' app inboxes. Delivery/read status is not confirmed.", actions=actions)
