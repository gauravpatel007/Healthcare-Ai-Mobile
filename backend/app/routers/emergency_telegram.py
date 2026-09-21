"""Owner-authenticated link issuance and Telegram-authenticated phone verification."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.emergency import EmergencyContact
from app.services.telegram_verification import audit, handle_update, issue_token, normalize_phone, utc, verification_url

router = APIRouter()


@router.post("/contacts/{contact_id}/telegram-verification")
async def create_verification(contact_id: str, user_id: CurrentUserId, response: Response,
                              db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    contact = (await db.execute(select(EmergencyContact).where(
        EmergencyContact.id == contact_id, EmergencyContact.user_id == user_id
    ).with_for_update())).scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    if contact.verification_status == "verified":
        raise HTTPException(409, "This contact is already verified.")
    if not verification_url("check"):
        raise HTTPException(503, "Telegram verification is not configured. Please contact support.")
    normalize_phone(contact.phone)
    now = datetime.now(timezone.utc)
    if contact.verification_requested_at and now - utc(contact.verification_requested_at) < timedelta(seconds=60):
        audit("resend_limited", contact)
        raise HTTPException(429, "Please wait 60 seconds before resending verification.", headers={"Retry-After": "60"})
    token = issue_token(contact)
    contact.verification_requested_at = now
    await db.flush()
    audit("issued", contact)
    return {"verification_url": verification_url(token), "expires_at": contact.verification_expires_at}


def authenticate_telegram(secret: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token")):
    expected = get_settings().TELEGRAM_WEBHOOK_SECRET
    if not expected or not secret or not secrets.compare_digest(secret.encode(), expected.encode()):
        raise HTTPException(403, "Invalid Telegram webhook credentials.")


@router.post("/telegram/webhook", dependencies=[Depends(authenticate_telegram)])
async def telegram_webhook(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(400, "Invalid Telegram update.")
    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid Telegram update.")
    result = await handle_update(payload, db)
    # Commit before Telegram acts on the sendMessage webhook response.
    await db.commit()
    return result
