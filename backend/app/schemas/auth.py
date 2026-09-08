"""
LifeOS Backend — Authentication Schemas
"""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="patient", pattern="^(patient|doctor|admin)$")


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class FaceSetupRequest(BaseModel):
    descriptor: list[float] = Field(..., min_length=128, max_length=128)


class FaceLoginRequest(BaseModel):
    email: EmailStr
    descriptor: list[float] = Field(..., min_length=128, max_length=128)


class WebAuthnRegisterBeginRequest(BaseModel):
    pass


class WebAuthnRegisterFinishRequest(BaseModel):
    attestation_response: dict


class WebAuthnLoginBeginRequest(BaseModel):
    email: EmailStr


class WebAuthnLoginFinishRequest(BaseModel):
    email: EmailStr
    assertion_response: dict


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(..., min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthResponse(BaseModel):
    success: bool = True
    message: str
    data: TokenResponse | dict | None = None


class UserInfoResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    name: str | None = None
    avatar_url: str | None = None
    face_login_enabled: bool = False
    two_factor_enabled: bool = False
    login_alerts_enabled: bool = True

class TwoFactorEnableRequest(BaseModel):
    code: str

class TwoFactorLoginRequest(BaseModel):
    temp_token: str
    code: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr
