"""Persistent, user-owned medication schedules, occurrences and delivery receipts."""
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base, TimestampMixin, generate_uuid


class ReminderSettings(Base, TimestampMixin):
    __tablename__ = "medicine_reminder_settings"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    grace_minutes: Mapped[int] = mapped_column(Integer, default=120)
    delivery: Mapped[str] = mapped_column(String(20), default="server")
    device_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    overrides: Mapped[dict] = mapped_column(JSON, default=dict)


class MedicineDose(Base, TimestampMixin):
    __tablename__ = "medicine_doses"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Keep the historical snapshot when a medicine is deleted.
    medicine_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(255))
    dosage: Mapped[str] = mapped_column(String(100), default="")
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    local_date: Mapped[str] = mapped_column(String(10))
    local_time: Mapped[str] = mapped_column(String(5))
    timezone: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    acted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    stock_used: Mapped[int] = mapped_column(Integer, default=0)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    push_attempts: Mapped[int] = mapped_column(Integer, default=0)


class ReminderAction(Base, TimestampMixin):
    __tablename__ = "medicine_reminder_actions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    dose_id: Mapped[str] = mapped_column(String(120))


class ReminderNotice(Base, TimestampMixin):
    __tablename__ = "medicine_reminder_notices"
    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    push_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    push_attempts: Mapped[int] = mapped_column(Integer, default=0)
    href: Mapped[str] = mapped_column(String(255), default="/app/medicine?tab=reminders")
