"""
LifeOS Backend — Chat Message Model
"""

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text, Boolean, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, generate_uuid


class ChatMessage(Base):
    """AI chat message (for all AI modules)."""

    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    role: Mapped[str] = mapped_column(
        SAEnum("user", "assistant", name="chat_role"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    module: Mapped[str] = mapped_column(
        SAEnum("assistant", "symptom", "nutrition", "fitness", "mental",
               name="ai_module"),
        nullable=False,
        default="assistant",
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    response_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    feedback: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
