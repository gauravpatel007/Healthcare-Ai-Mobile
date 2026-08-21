"""
LifeOS Backend — Disease & Symptom Models
"""

from sqlalchemy import Boolean, String, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin, generate_uuid

class DiseaseLibrary(Base, TimestampMixin):
    """Global database of diseases and their information."""

    __tablename__ = "disease_library"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    symptoms: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    causes: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    treatment: Mapped[str] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(50), nullable=True)
    emergency_level: Mapped[str] = mapped_column(String(50), nullable=True)
    risk_factors: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    home_remedies: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    doctor_recommendation: Mapped[str] = mapped_column(Text, nullable=True)
    related_diseases: Mapped[list] = mapped_column(JSON, nullable=True, default=list)


class SymptomLibrary(Base, TimestampMixin):
    """Global database of symptoms."""

    __tablename__ = "symptom_library"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    categories: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    severity_levels: Mapped[str] = mapped_column(String(100), nullable=True)
    body_parts: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    emergency_flags: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    medical_suggestions: Mapped[str] = mapped_column(Text, nullable=True)


class SymptomCheckHistory(Base, TimestampMixin):
    """History of AI symptom checks performed by users."""

    __tablename__ = "symptom_check_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    symptoms: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    duration: Mapped[str] = mapped_column(String(100), nullable=True)
    severity: Mapped[str] = mapped_column(String(100), nullable=True)
    age_group: Mapped[str] = mapped_column(String(100), nullable=True)
    
    predicted_conditions: Mapped[list] = mapped_column(JSON, nullable=True, default=list)
    urgency: Mapped[str] = mapped_column(String(50), nullable=True)

    # Relationships
    user = relationship("User", backref="symptom_checks")

class UserCustomSymptom(Base, TimestampMixin):
    """Custom symptoms added by specific users."""

    __tablename__ = "user_custom_symptoms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    translations: Mapped[dict] = mapped_column(JSON, default=dict)
