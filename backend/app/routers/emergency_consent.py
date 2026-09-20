"""Free, manually shared emergency invitations. No SMS/WhatsApp provider calls."""
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.emergency import EmergencyContact, EmergencyContactConsent
from app.models.notification import SystemNotification
from app.models.user import User, UserProfile
from app.schemas.emergency import EmergencyContactResponse

router = APIRouter()


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def whatsapp_number(phone):
    """Require explicit country code, rather than guessing a recipient country."""
    value = re.sub(r"[\s().-]", "", phone or "")
    if value.startswith("00"):
        value = "+" + value[2:]
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", value):
        raise HTTPException(422, "Use an international phone number with country code, for example +91 followed by the 10-digit number.")
    return value[1:]


async def contact_response(contact, db):
    response = EmergencyContactResponse.model_validate(contact)
    consent = await db.get(EmergencyContactConsent, contact.id)
    if consent:
        response.consent_status = consent.status
        response.consent_accepted_at = consent.accepted_at
        if consent.status == "accepted" and consent.recipient_user_id:
            recipient = await db.get(User, consent.recipient_user_id)
            if recipient:
                # Let the sender identify who actually accepted a forwarded link.
                response.accepted_by = recipient.email
    return response


async def reset_consent(contact_id, db):
    await db.execute(update(EmergencyContactConsent).where(
        EmergencyContactConsent.contact_id == contact_id
    ).values(status="pending", token_hash=None, expires_at=None,
             recipient_user_id=None, recipient_email=None, email_opt_in=False, accepted_at=None))


@router.post("/contacts/{contact_id}/invitation")
async def create_invitation(contact_id: str, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    contact = (await db.execute(select(EmergencyContact).where(
        EmergencyContact.id == contact_id, EmergencyContact.user_id == user_id
    ).with_for_update())).scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    number = whatsapp_number(contact.phone)
    consent = await db.get(EmergencyContactConsent, contact.id)
    now = datetime.now(timezone.utc)
    if consent and consent.status == "accepted":
        raise HTTPException(409, "This contact has already accepted.")
    if not consent:
        consent = EmergencyContactConsent(contact_id=contact.id)
        db.add(consent)
    token = secrets.token_urlsafe(32)
    consent.status = "pending"
    consent.token_hash = token_digest(token)
    consent.expires_at = now + timedelta(days=7)
    consent.recipient_user_id = None
    consent.recipient_email = None
    consent.email_opt_in = False
    consent.accepted_at = None
    await db.flush()
    return {"token": token, "whatsapp_number": number, "expires_at": consent.expires_at}


class InvitationToken(BaseModel):
    token: str = Field(min_length=40, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")


class AcceptInvitation(InvitationToken):
    consent: bool
    email_opt_in: bool = False


async def pending_invitation(token, db):
    row = (await db.execute(select(EmergencyContactConsent, EmergencyContact).join(
        EmergencyContact, EmergencyContact.id == EmergencyContactConsent.contact_id
    ).where(
        EmergencyContactConsent.token_hash == token_digest(token),
        EmergencyContactConsent.status == "pending",
        EmergencyContactConsent.expires_at > datetime.now(timezone.utc),
    ))).first()
    if not row:
        raise HTTPException(410, "This invitation has expired, was replaced, or has already been used. Ask the sender for a new invitation.")
    return row


@router.post("/invitations/preview")
async def preview_invitation(data: InvitationToken, db: AsyncSession = Depends(get_db)):
    consent, contact = await pending_invitation(data.token, db)
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == contact.user_id))).scalar_one_or_none()
    return {"sender_name": profile.name if profile else "A LifeOS user", "expires_at": consent.expires_at,
            "email_required": bool(contact.email)}


@router.post("/invitations/accept")
async def accept_invitation(data: AcceptInvitation, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    if not data.consent:
        raise HTTPException(422, "Please explicitly agree to receive this user's SOS alerts.")
    consent, contact = await pending_invitation(data.token, db)
    if contact.user_id == user_id:
        raise HTTPException(403, "You cannot accept your own emergency contact invitation. Share it with your contact.")
    user = await db.get(User, user_id)
    if not user or not user.is_active or user.is_deleted or not user.is_verified:
        raise HTTPException(403, "Log in with a verified, active account to accept.")
    if contact.email and contact.email.strip().casefold() != user.email.casefold():
        raise HTTPException(403, "Log in with the email address the sender entered for this contact, or ask the sender to correct it.")
    now = datetime.now(timezone.utc)
    result = await db.execute(update(EmergencyContactConsent).execution_options(synchronize_session="fetch").where(
        EmergencyContactConsent.contact_id == contact.id,
        EmergencyContactConsent.token_hash == token_digest(data.token),
        EmergencyContactConsent.status == "pending",
        EmergencyContactConsent.expires_at > now,
    ).values(status="accepted", token_hash=None, expires_at=None, recipient_user_id=user_id,
             recipient_email=user.email, email_opt_in=data.email_opt_in, accepted_at=now))
    if result.rowcount != 1:
        raise HTTPException(409, "This invitation is no longer available.")
    return {"success": True, "message": "SOS app alerts accepted. You can stop receiving them at any time.",
            "email_enabled": data.email_opt_in}


@router.get("/accepted-contacts")
async def accepted_contacts(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EmergencyContactConsent, UserProfile.name).join(
        EmergencyContact, EmergencyContact.id == EmergencyContactConsent.contact_id
    ).outerjoin(UserProfile, UserProfile.user_id == EmergencyContact.user_id).where(
        EmergencyContactConsent.recipient_user_id == user_id,
        EmergencyContactConsent.status == "accepted",
    ))).all()
    return [{"contact_id": consent.contact_id, "sender_name": name or "LifeOS user",
             "email_enabled": consent.email_opt_in, "accepted_at": consent.accepted_at} for consent, name in rows]


@router.post("/accepted-contacts/{contact_id}/revoke")
async def revoke_consent(contact_id: str, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    result = await db.execute(update(EmergencyContactConsent).where(
        EmergencyContactConsent.contact_id == contact_id,
        EmergencyContactConsent.recipient_user_id == user_id,
    ).values(status="revoked", token_hash=None, expires_at=None, email_opt_in=False))
    if result.rowcount != 1:
        raise HTTPException(404, "Accepted contact not found")
    return {"success": True}


@router.get("/received-alerts")
async def received_alerts(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SystemNotification).where(
        SystemNotification.type == "SOS", SystemNotification.target_audience == user_id,
        SystemNotification.status == "Sent",
    ).order_by(SystemNotification.created_at.desc()).limit(50))).scalars().all()
    return [{"id": row.id, "message": row.message, "created_at": row.created_at} for row in rows]
