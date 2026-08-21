"""
LifeOS Backend — Medical Record Schemas
"""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class RecordCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., pattern="^(blood_test|imaging|prescription|surgery|vaccination|other)$")
    doctor: str = ""
    hospital: str = ""
    date: Optional[date] = None
    findings: str | None = None
    notes: str | None = None
    family_member_id: str | None = None


class RecordUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = None
    doctor: str | None = None
    hospital: str | None = None
    date: str | None = None
    findings: str | None = None
    notes: str | None = None
    family_member_id: str | None = None


class RecordResponse(BaseModel):
    id: str
    user_id: str
    title: str
    category: str
    doctor: str | None
    hospital: str | None
    date: Optional[date]
    findings: str | None
    notes: str | None
    file_path: str | None
    family_member_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecordCompareRequest(BaseModel):
    record_id_1: str
    record_id_2: str
    language: str | None = "en"


class AIRecordSummary(BaseModel):
    record_id: str
    summary: str
    disclaimer: str = "This is an AI-generated summary. Always consult your doctor for medical advice."
