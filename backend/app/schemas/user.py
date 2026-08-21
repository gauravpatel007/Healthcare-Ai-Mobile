"""
LifeOS Backend — User & Profile Schemas
"""

from pydantic import BaseModel, Field


class UserProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str
    age: int
    gender: str
    blood_type: str
    height: float
    weight: float
    allergies: list[str] = []
    conditions: list[str] = []
    organ_donor: bool = False
    organ_preferences: dict = {}
    language: str = "en"
    measurement_unit: str = "metric"
    avatar_url: str | None = None
    connected_devices: list[str] = []
    step_goal: int = 10000
    target_weight: float | None = None
    target_weight_timeline: str | None = None
    calorie_goal: int | None = None
    burn_calorie_goal: int | None = None
    notification_preferences: dict | None = None
    push_device_token: str | None = None

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    age: int | None = Field(None, ge=0, le=150)
    gender: str | None = None
    blood_type: str | None = None
    height: float | None = Field(None, gt=0)
    weight: float | None = Field(None, gt=0)
    allergies: list[str] | None = None
    conditions: list[str] | None = None
    organ_donor: bool | None = None
    organ_preferences: dict | None = None
    language: str | None = Field(None, pattern="^(en|hi|gu)$")
    measurement_unit: str | None = Field(None, pattern="^(metric|imperial)$")
    avatar_url: str | None = None
    step_goal: int | None = Field(None, ge=100)
    target_weight: float | None = None
    target_weight_timeline: str | None = None
    calorie_goal: int | None = Field(None, ge=500, le=10000)
    burn_calorie_goal: int | None = Field(None, ge=100, le=5000)
    notification_preferences: dict | None = None


class SettingsUpdate(BaseModel):
    language: str | None = Field(None, pattern="^(en|hi|gu)$")
    measurement_unit: str | None = Field(None, pattern="^(metric|imperial)$")
