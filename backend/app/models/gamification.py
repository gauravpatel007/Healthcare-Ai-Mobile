"""
LifeOS Backend — Gamification Models
"""

from sqlalchemy import ForeignKey, Integer, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin, generate_uuid


class UserGamification(Base, TimestampMixin):
    """User gamification profile tracking XP, levels, and streaks."""

    __tablename__ = "user_gamification"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    nickname: Mapped[str] = mapped_column(String(100), nullable=False, default="Anonymous User")
    xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    
    # Streaks in JSON format, e.g. {"medication": {"current": 5, "best": 12, "last_date": "2024-01-01"}}
    streaks: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: {
        "medication": {"current": 0, "best": 0, "last_date": None},
        "workout": {"current": 0, "best": 0, "last_date": None},
        "steps": {"current": 0, "best": 0, "last_date": None},
        "nutrition": {"current": 0, "best": 0, "last_date": None},
        "sleep": {"current": 0, "best": 0, "last_date": None}
    })

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="gamification")
