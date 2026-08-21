"""
LifeOS Backend — Challenge & Badge Models
"""

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin, generate_uuid


class CommunityChallenge(Base, TimestampMixin):
    """Global community health challenge."""

    __tablename__ = "community_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    goal_text: Mapped[str] = mapped_column(String(200), nullable=False)
    target: Mapped[int] = mapped_column(Integer, nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=True, default="🏆")
    color: Mapped[str] = mapped_column(String(50), nullable=True, default="blue")
    participants_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ChallengeProgress(Base):
    """Daily progress on a health challenge."""

    __tablename__ = "challenge_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    challenge_id: Mapped[str] = mapped_column(String(36), nullable=False)  # e.g. "steps10k" or CommunityChallenge.id
    date: Mapped[str] = mapped_column(Date, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target: Mapped[int] = mapped_column(Integer, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class UserBadge(Base):
    """Badge earned by a user."""

    __tablename__ = "user_badges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    badge_name: Mapped[str] = mapped_column(String(100), nullable=False)
    earned_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
