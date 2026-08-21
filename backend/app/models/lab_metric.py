"""
LifeOS Backend — Lab Metric Model
"""

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date

from app.database import Base, TimestampMixin, generate_uuid


class LabMetric(Base, TimestampMixin):
    """Extracted lab metrics from medical records."""

    __tablename__ = "lab_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    record_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("medical_records.id", ondelete="CASCADE"), nullable=True, index=True
    )
    
    metric_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    value: Mapped[str] = mapped_column(String(100), nullable=False) 
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_range: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True) 
    
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Relationships
    # Note: adding back_populates requires modifying MedicalRecord
    record = relationship("MedicalRecord", back_populates="lab_metrics")
