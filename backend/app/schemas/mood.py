"""
LifeOS Backend — Mood & Journal Schemas
"""

from datetime import datetime
from pydantic import BaseModel, Field


class MoodCreate(BaseModel):
    mood: str = Field(..., max_length=10)  # emoji
    note: str | None = None


class MoodResponse(BaseModel):
    id: str
    mood: str
    note: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class JournalCreate(BaseModel):
    content: str = Field(..., min_length=1)
    language: str = "en"


class JournalResponse(BaseModel):
    id: str
    content: str
    sentiment: str | None
    ai_analysis: str | None
    proactive_action: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class MoodAnalysis(BaseModel):
    average_score: float
    trend: str
    analysis: str
    stress_level: int  # 0-100


class ScreeningRequest(BaseModel):
    answers: list[int] = Field(..., min_length=6, max_length=6)  # 0-3 each


class ScreeningResponse(BaseModel):
    score: int
    max_score: int
    percentage: int
    result: str
    advice: str
