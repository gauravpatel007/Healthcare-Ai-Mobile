"""
LifeOS Backend — Medical Record Model
"""

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, String, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin, generate_uuid


class MedicalRecord(Base, TimestampMixin):
    """Medical record / report entry."""

    __tablename__ = "medical_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    family_member_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    doctor: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    hospital: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    date: Mapped[str] = mapped_column(Date, nullable=True)
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="approved", nullable=False)
    report_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    report_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_analyzed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    lab_metrics = relationship("LabMetric", back_populates="record", cascade="all, delete-orphan")
