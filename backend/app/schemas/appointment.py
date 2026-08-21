"""
LifeOS Backend — Appointment Schemas
"""

from datetime import date, datetime, time
from typing import Optional
from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    doctor: str = Field(..., min_length=1, max_length=255)
    specialty: str = ""
    hospital: str = ""
    date: date
    time: time
    notes: str | None = None
    status: str = Field(default="upcoming", pattern="^(upcoming|completed|cancelled)$")


class AppointmentUpdate(BaseModel):
    doctor: str | None = Field(None, min_length=1, max_length=255)
    specialty: str | None = None
    hospital: str | None = None
    date: Optional[date] = None
    time: Optional[time] = None
    notes: str | None = None
    status: str | None = None


class AppointmentResponse(BaseModel):
    id: str
    user_id: str
    doctor: str
    specialty: str
    hospital: str
    date: date
    time: time
    notes: str | None
    status: str
    ai_prep_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AppointmentPrepRequest(BaseModel):
    symptoms: str | None = None
    language: str | None = None


class AppointmentSuggestion(BaseModel):
    text: str
    specialist: str
    urgency: str  # Low, Medium, High
