"""
LifeOS Backend — Emergency Schemas
"""

from datetime import datetime
from pydantic import BaseModel, Field


class EmergencyContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    phone: str = Field(..., min_length=1, max_length=20)
    email: str | None = None
    carrier: str | None = None
    relation: str = ""
    is_primary: bool = False


class EmergencyContactUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    phone: str | None = None
    email: str | None = None
    carrier: str | None = None
    relation: str | None = None
    is_primary: bool | None = None


class EmergencyContactResponse(BaseModel):
    id: str
    user_id: str
    name: str
    phone: str
    email: str | None
    carrier: str | None
    relation: str
    is_primary: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SOSAlertRequest(BaseModel):
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    accuracy: float | None = None
    is_silent: bool = False
    session_id: str | None = None


class SOSAlertResponse(BaseModel):
    success: bool = True
    message: str = "SOS Emergency Alert Activated"
    actions: list[str] = Field(default_factory=list)
    emergency_number: str = "112"


class SOSAudioClipResponse(BaseModel):
    id: str
    user_id: str
    file_path: str
    original_filename: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class QRHealthData(BaseModel):
    name: str
    blood_type: str
    age: int
    gender: str
    allergies: list[str]
    conditions: list[str]
    medicines: list[str]
    emergency_contacts: list[dict]
    organ_donor: bool = False
    organ_preferences: dict = {}


class OrganPreferencesUpdate(BaseModel):
    organ_donor: bool
    organ_preferences: dict


class OrganSuitabilityRequest(BaseModel):
    questionnaire_answers: dict = {}

class OrganMatchRequest(BaseModel):
    donor_id: str
    organ: str
