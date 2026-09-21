"""
LifeOS Backend — Emergency Contact Model
"""

from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, String, JSON, Text, Integer, BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin, generate_uuid


class EmergencyContact(Base, TimestampMixin):
    """Emergency contact for a user."""

    __tablename__ = "emergency_contacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    carrier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    relation: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending", nullable=False)
    telegram_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)


class TelegramVerificationSession(Base):
    """Private-chat binding and persistent rate limit, shared across workers."""

    __tablename__ = "telegram_verification_sessions"

    telegram_user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_id: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class EmergencyContactConsent(Base, TimestampMixin):
    """Link consent binds alerts to a logged-in account, never to a phone number."""

    __tablename__ = "emergency_contact_consents"

    contact_id: Mapped[str] = mapped_column(String(36), ForeignKey("emergency_contacts.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recipient_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_opt_in: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SOSLog(Base, TimestampMixin):
    """Log of when a user triggered an SOS emergency alert."""

    __tablename__ = "sos_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_silent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AITriageLog(Base, TimestampMixin):
    """Log of AI Triage symptom evaluation."""

    __tablename__ = "ai_triage_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symptom: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[dict] = mapped_column(JSON, nullable=False)


class SOSAudioClip(Base, TimestampMixin):
    """Custom audio clip to play during an SOS call."""

    __tablename__ = "sos_audio_clips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
