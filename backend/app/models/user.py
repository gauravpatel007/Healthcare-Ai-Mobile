"""
LifeOS Backend — User & Profile Models
"""

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Integer, String, Text, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.database import Base, TimestampMixin, generate_uuid


class User(Base, TimestampMixin):
    """Core user account."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        SAEnum("patient", "doctor", "admin", name="user_role"),
        default="patient",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    face_login_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    face_descriptor: Mapped[str | None] = mapped_column(Text, nullable=True)
    two_factor_secret: Mapped[str | None] = mapped_column(String(32), nullable=True)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    login_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    profile_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    account_status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    premium_plan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    profile: Mapped["UserProfile"] = relationship(
        "UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    gamification: Mapped["UserGamification"] = relationship(
        "UserGamification", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class UserProfile(Base, TimestampMixin):
    """Extended user profile with health data."""

    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, default="User")
    age: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    gender: Mapped[str] = mapped_column(String(20), nullable=False, default="Male")
    blood_type: Mapped[str] = mapped_column(String(5), nullable=False, default="O+")
    height: Mapped[float] = mapped_column(nullable=False, default=170.0)
    weight: Mapped[float] = mapped_column(nullable=False, default=70.0)
    step_goal: Mapped[int] = mapped_column(Integer, nullable=False, default=10000)
    target_weight: Mapped[float | None] = mapped_column(nullable=True)
    target_weight_timeline: Mapped[str | None] = mapped_column(String(100), nullable=True)
    calorie_goal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    burn_calorie_goal: Mapped[int] = mapped_column(Integer, nullable=False, default=500)
    allergies: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    conditions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    chronic_conditions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    emergency_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    organ_donor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    organ_preferences: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    measurement_unit: Mapped[str] = mapped_column(String(10), default="metric", nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    connected_devices: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    notification_preferences: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: {
        "medicine": {"email": True, "sms": False, "app": True},
        "appointment": {"emergency_sms": False, "app": True},
        "fitness": {"email": False, "app": True}
    })
    fitbit_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    fitbit_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    push_device_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="profile")


class PasswordResetToken(Base, TimestampMixin):
    """Temporary tokens for password resets."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    reset_code: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class EmailVerificationToken(Base, TimestampMixin):
    """Temporary tokens for email verification during signup."""

    __tablename__ = "email_verification_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    verification_code: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class LoginHistory(Base, TimestampMixin):
    """Tracks user logins for security alerts."""

    __tablename__ = "login_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="Success", nullable=False)

class BlockedIP(Base, TimestampMixin):
    """Tracks IP addresses blocked from accessing the system."""

    __tablename__ = "blocked_ips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    ip_address: Mapped[str] = mapped_column(String(45), unique=True, index=True, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    blocked_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserActivity(Base):
    """Logs individual activities taken by users."""
    __tablename__ = "user_activities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    activity: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
