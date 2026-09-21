"""Telegram phone proof only; does not change account/email consent or delivery."""
import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select

from app.config import get_settings
from app.models.emergency import EmergencyContact, TelegramVerificationSession
from app.models.user import UserProfile

logger = logging.getLogger("lifeos.emergency.verification")
TOKEN_TTL = timedelta(hours=24)
MAX_TOKEN_ATTEMPTS = 5
MAX_CHAT_MESSAGES = 30
INVALID_LINK = "This verification link has expired, was replaced, or is no longer available. Ask the LifeOS user to resend verification."
MISMATCH = "❌ Phone number does not match the emergency contact number registered in LifeOS. Verification failed."
SUCCESS = "✅ Your phone number has been verified successfully. You are now an emergency contact for this LifeOS user."
WELCOME = ("LifeOS Emergency Contact Verification\n\nOpen the personal verification link shared by the LifeOS user who added you. "
           "The link identifies their request. Typing /start alone cannot identify who invited you. "
           "Ask them to use Share via WhatsApp or Copy Link in Emergency Contacts.")


def normalize_phone(phone, *, telegram=False):
    """Canonical international digits; never guess a country for a local number."""
    value = re.sub(r"[\s().-]", "", phone or "")
    if value.startswith("00"):
        value = "+" + value[2:]
    elif telegram and not value.startswith("+"):
        # Telegram supplies the country code, sometimes without a leading +.
        value = "+" + value
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", value):
        raise HTTPException(422, "Use an international phone number with country code, for example +919876543210.")
    return value


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def verification_url(token):
    settings = get_settings()
    username = settings.TELEGRAM_BOT_USERNAME.strip().lstrip("@")
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_WEBHOOK_SECRET
            and re.fullmatch(r"[A-Za-z0-9_]{5,32}", username)):
        return None
    return f"https://t.me/{username}?start={token}"


def issue_token(contact):
    token = secrets.token_urlsafe(32)
    contact.verification_status = "pending"
    contact.telegram_verified = False
    contact.verified_at = None
    contact.verification_token_hash = digest(token)
    contact.verification_expires_at = datetime.now(timezone.utc) + TOKEN_TTL
    contact.verification_attempts = 0
    return token


def audit(outcome, contact=None):
    # Never log phone numbers, chat IDs, request bodies, raw tokens or token hashes.
    logger.info("Telegram verification outcome=%s contact_id=%s", outcome, contact.id if contact else "unknown")


def reply(chat_id, text, *, request_contact=False, confirmation=False):
    # Telegram supports sendMessage directly as the HTTPS webhook response.
    keyboard = {"remove_keyboard": True}
    if confirmation or request_contact:
        keyboard = {"keyboard": [[{"text": "Confirm"}, {"text": "Decline"}]] if confirmation else
                    [[{"text": "Share My Phone Number", "request_contact": True}]],
                    "resize_keyboard": True, "one_time_keyboard": True}
    return {"method": "sendMessage", "chat_id": chat_id, "text": text, "reply_markup": keyboard}


async def confirm_request(actor, contact, db):
    name = (await db.execute(select(UserProfile.name).where(UserProfile.user_id == contact.user_id))).scalar_one_or_none()
    name = (name or "A LifeOS user").strip()[:100]
    number = normalize_phone(contact.phone)
    return reply(actor, f"LifeOS Emergency Contact Verification\n\n{name} has asked you to be their SOS emergency contact "
                 f"in LifeOS for the phone number ending {number[-4:]}. They may need to contact you urgently in an emergency.\n\n"
                 "Do you agree to be this user's emergency contact? Select Confirm only if you know them. "
                 "You must then share your own matching phone number to finish verification.\n\n"
                 "LifeOS currently sends app/email alerts after a separate account invitation is accepted; automated live calls are not enabled.",
                 confirmation=True)


async def handle_update(payload, db):
    message = payload.get("message")
    if not isinstance(message, dict):
        return {"ok": True}
    chat, sender = message.get("chat") or {}, message.get("from") or {}
    if not isinstance(chat, dict) or not isinstance(sender, dict):
        return {"ok": True}
    actor, message_id = sender.get("id"), message.get("message_id")
    if (chat.get("type") != "private" or type(actor) is not int or actor <= 0
            or chat.get("id") != actor or sender.get("is_bot")
            or type(message_id) is not int or message_id <= 0):
        audit("rejected_context")
        return {"ok": True}
    now = datetime.now(timezone.utc)
    # Upsert before locking also serializes the very first concurrent requests.
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    await db.execute(insert(TelegramVerificationSession).values(
        telegram_user_id=actor, last_message_id=0, attempts=0, window_started_at=now
    ).on_conflict_do_nothing(index_elements=["telegram_user_id"]))
    session = (await db.execute(select(TelegramVerificationSession).where(
        TelegramVerificationSession.telegram_user_id == actor
    ).with_for_update().execution_options(populate_existing=True))).scalar_one()
    if message_id <= session.last_message_id:
        return {"ok": True}  # Duplicate/reordered webhook must not apply to a new token.
    session.last_message_id = message_id
    if now - utc(session.window_started_at) >= timedelta(minutes=10):
        session.window_started_at, session.attempts = now, 0
    if session.attempts >= MAX_CHAT_MESSAGES:
        session.token_hash = None
        session.confirmed_at = None
        audit("rate_limited")
        return reply(actor, "Too many verification attempts. Please wait 10 minutes and open your verification link again.")
    session.attempts += 1

    text = message.get("text", "")
    if isinstance(text, str) and text.startswith("/start"):
        session.confirmed_at = None
        bare_start = re.fullmatch(r"/start(?:@[A-Za-z0-9_]+)?", text.strip())
        previous_hash = session.token_hash if bare_start else None
        session.token_hash = None
        match = re.fullmatch(r"/start(?:@[A-Za-z0-9_]+)? ([A-Za-z0-9_-]{43})", text)
        contact = None
        token_hash = digest(match[1]) if match else previous_hash
        if token_hash:
            contact = (await db.execute(select(EmergencyContact).where(
                EmergencyContact.verification_token_hash == token_hash,
                EmergencyContact.verification_status == "pending",
                EmergencyContact.verification_expires_at > now,
                EmergencyContact.verification_attempts < MAX_TOKEN_ATTEMPTS,
            ).with_for_update())).scalar_one_or_none()
        if not contact:
            audit("invalid_start")
            return reply(actor, WELCOME if bare_start else INVALID_LINK)
        session.token_hash = contact.verification_token_hash
        audit("started", contact)
        return await confirm_request(actor, contact, db)

    contact = (await db.execute(select(EmergencyContact).where(
        EmergencyContact.verification_token_hash == session.token_hash,
        EmergencyContact.verification_token_hash.is_not(None),
        EmergencyContact.verification_status == "pending",
        EmergencyContact.verification_expires_at > now,
        EmergencyContact.verification_attempts < MAX_TOKEN_ATTEMPTS,
    ).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if not contact:
        session.token_hash = None
        session.confirmed_at = None
        audit("invalid_session")
        return reply(actor, INVALID_LINK)
    forwarded = any(message.get(key) for key in ("forward_origin", "forward_from", "forward_sender_name"))
    if text == "Decline" and not forwarded:
        session.token_hash = None
        session.confirmed_at = None
        audit("declined", contact)
        return reply(actor, "You declined this emergency-contact request. Your phone number has not been verified.")
    if text == "Confirm" and not forwarded:
        session.confirmed_at = now
        audit("confirmed", contact)
        return reply(actor, "Thank you for confirming. Please use Share My Phone Number below. "
                     "Only the Telegram account whose phone number matches this emergency contact can verify it.", request_contact=True)
    if not session.confirmed_at:
        audit("confirmation_required", contact)
        return await confirm_request(actor, contact, db)
    shared = message.get("contact")
    if not isinstance(shared, dict):
        return reply(actor, "Use Share My Phone Number to verify your own phone number.", request_contact=True)
    contact.verification_attempts += 1
    own_contact = shared.get("user_id") == actor and not forwarded
    matched = False
    if own_contact and isinstance(shared.get("phone_number"), str):
        try:
            matched = normalize_phone(contact.phone) == normalize_phone(shared["phone_number"], telegram=True)
        except HTTPException:
            pass
    if not matched:
        audit("mismatch" if own_contact else "not_own_contact", contact)
        if contact.verification_attempts >= MAX_TOKEN_ATTEMPTS:
            contact.verification_status = "unverified"
            contact.verification_token_hash = None
            contact.verification_expires_at = None
            session.token_hash = None
            session.confirmed_at = None
        return reply(actor, MISMATCH, request_contact=contact.verification_status == "pending")
    contact.verification_status = "verified"
    contact.telegram_verified = True
    contact.verified_at = now
    contact.verification_token_hash = None
    contact.verification_expires_at = None
    session.token_hash = None
    session.confirmed_at = None
    audit("verified", contact)
    return reply(actor, SUCCESS)
