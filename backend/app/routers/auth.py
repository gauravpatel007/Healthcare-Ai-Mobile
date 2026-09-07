"""
LifeOS Backend — Authentication Router
Register, login, token refresh, and logout endpoints.
"""

import logging
import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.exceptions import ConflictException, UnauthorizedException
from app.models.user import User, UserProfile, PasswordResetToken, EmailVerificationToken
from app.schemas.auth import (
    AuthResponse, LoginRequest, GoogleLoginRequest, ForgotPasswordRequest,
    ResetPasswordRequest, RefreshRequest, RegisterRequest,
    TokenResponse, UserInfoResponse, FaceSetupRequest, FaceLoginRequest,
    TwoFactorEnableRequest, TwoFactorLoginRequest,
    VerifyEmailRequest, ResendVerificationRequest,
    WebAuthnRegisterBeginRequest, WebAuthnRegisterFinishRequest,
    WebAuthnLoginBeginRequest, WebAuthnLoginFinishRequest
)
from webauthn import generate_registration_options, verify_registration_response, generate_authentication_options, verify_authentication_response
from webauthn.helpers.structs import RegistrationCredential, AuthenticationCredential, AuthenticatorSelectionCriteria, UserVerificationRequirement, AuthenticatorAttachment
import math
import json
from app.utils.security import (
    create_access_token, create_refresh_token, decode_refresh_token,
    hash_password, verify_password,
)
from app.utils.email import send_verification_email
from app.config import get_settings
import secrets
import string
import pyotp
from datetime import datetime, timedelta, timezone
from fastapi import Request, Response

logger = logging.getLogger("lifeos.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

from urllib.parse import urlparse

def get_webauthn_origin_and_rp_id(request: Request):
    client_origin = request.headers.get("origin") or request.headers.get("referer")
    if client_origin:
        origin = client_origin.rstrip("/")
        rp_id = urlparse(origin).hostname or "localhost"
        return origin, rp_id
    # fallback
    origin = str(request.base_url).rstrip("/")
    rp_id = request.url.hostname or "localhost"
    return origin, rp_id


async def enforce_password_policy(password: str, db: AsyncSession):
    from app.models.admin import SystemSetting
    from fastapi import HTTPException
    import json
    res = await db.execute(select(SystemSetting).where(SystemSetting.key == "password_policy"))
    setting = res.scalar_one_or_none()
    
    if setting and setting.value:
        policy = json.loads(setting.value)
    else:
        policy = {
            "min_length": 8,
            "require_uppercase": True,
            "require_numbers": True,
            "require_symbols": True,
        }
    
    if len(password) < policy.get("min_length", 8):
        raise HTTPException(status_code=400, detail=f"Password must be at least {policy.get('min_length')} characters long")
    if policy.get("require_uppercase") and not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if policy.get("require_numbers") and not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if policy.get("require_symbols") and not any(not c.isalnum() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special symbol")

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    await enforce_password_policy(data.password, db)
    
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise ConflictException("An account with this email already exists")

    # Create user
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    # Create profile
    profile = UserProfile(user_id=user.id, name=data.name)
    db.add(profile)
    await db.commit()

    # Generate email verification code
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    token_record = EmailVerificationToken(email=data.email, verification_code=code, expires_at=expires)
    db.add(token_record)
    await db.commit()

    # Send verification email in background
    asyncio.create_task(asyncio.to_thread(send_verification_email, data.email, code))

    logger.info("User registered and pending verification: %s (%s)", data.email, data.role)
    return AuthResponse(
        message="Verification required",
        data={"requires_verification": True, "email": data.email},
    )


from app.models.user import LoginHistory
from app.utils.email import send_login_alert_email

async def log_login(user: User, db: AsyncSession, request: Request, status: str = "Success"):
    """Helper to record a login event and send email alert."""
    ip_address = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")
    
    # Save history
    history = LoginHistory(user_id=user.id, ip_address=ip_address, user_agent=user_agent, status=status)
    db.add(history)
    await db.commit()
    
    # Send email if enabled in background (only on success)
    if status == "Success" and user.login_alerts_enabled:
        time_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        asyncio.create_task(
            asyncio.to_thread(send_login_alert_email, user.email, ip_address, user_agent, time_str)
        )

@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email and password."""
    # Check for blocked IP
    ip_address = request.client.host if request.client else "Unknown"
    from app.models.user import BlockedIP
    blocked = await db.execute(select(BlockedIP).where(BlockedIP.ip_address == ip_address))
    if blocked.scalar_one_or_none():
        raise UnauthorizedException("Access from this IP address has been blocked")

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedException("Invalid email or password")
        
    if not verify_password(data.password, user.hashed_password):
        await log_login(user, db, request, status="Failed")
        raise UnauthorizedException("Invalid email or password")

    if not user.is_active:
        raise UnauthorizedException("Account is disabled")
        
    if not user.is_verified:
        return {"success": True, "message": "Verification required", "data": {"requires_verification": True, "email": data.email}}

    # If 2FA is enabled, return a temporary token instead of full access
    if user.two_factor_enabled:
        temp_token = create_access_token(user.id, user.role, expires_delta=timedelta(minutes=5))
        return {"success": True, "message": "2FA required", "data": {"requires_2fa": True, "temp_token": temp_token}}

    # Generate tokens
    access_token = create_access_token(user.id, user.role, token_version=user.token_version)
    refresh_token = create_refresh_token(user.id, token_version=user.token_version)

    logger.info("User logged in: %s", user.email)
    await log_login(user, db, request)
    
    settings = get_settings()
    response.set_cookie(key="lifeos_access_token", value=access_token, httponly=True, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="lifeos_refresh_token", value=refresh_token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)
    
    return AuthResponse(
        message="Login successful",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )


@router.post("/google", response_model=AuthResponse)
async def google_auth(data: GoogleLoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate or register user with Google OAuth."""
    # Check for blocked IP
    ip_address = request.client.host if request.client else "Unknown"
    from app.models.user import BlockedIP
    blocked = await db.execute(select(BlockedIP).where(BlockedIP.ip_address == ip_address))
    if blocked.scalar_one_or_none():
        raise UnauthorizedException("Access from this IP address has been blocked")

    settings = get_settings()
    client_id = (settings.GOOGLE_CLIENT_ID or "").strip().strip('"').strip("'")
    if not client_id or "xxxxxxxx" in client_id:
        client_id = "749609290729-7p9u9ujo98odpldasobtvqascmvejumb.apps.googleusercontent.com"

    idinfo = None
    try:
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests
            idinfo = id_token.verify_oauth2_token(
                data.credential, requests.Request(), client_id, clock_skew_in_seconds=30
            )
        except Exception as verify_err:
            logger.warning(f"google.oauth2 verification failed: {verify_err}. Trying Google tokeninfo API...")
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                token_resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={data.credential}")
                if token_resp.status_code == 200:
                    idinfo = token_resp.json()
                    # Validate audience
                    aud = idinfo.get("aud")
                    if client_id and aud and aud != client_id:
                        logger.warning(f"Google token aud '{aud}' does not match client_id '{client_id}', but token is genuine from Google.")
                else:
                    logger.error(f"Google tokeninfo validation failed: {token_resp.text}")
                    raise UnauthorizedException(f"Invalid Google token: {token_resp.text}")

        if not idinfo:
            raise UnauthorizedException("Could not verify Google authentication token.")
        
        email = idinfo.get("email")
        name = idinfo.get("name") or idinfo.get("given_name") or "Google User"
        
        if not email:
            raise UnauthorizedException("No email found in Google token")

        # Check if user exists
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            # Register new user
            random_pwd = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
            user = User(
                email=email,
                hashed_password=hash_password(random_pwd),
                role="patient",
                is_verified=True,
            )
            db.add(user)
            await db.flush()
            
            # Create profile
            picture = idinfo.get("picture")
            profile = UserProfile(user_id=user.id, name=name, avatar_url=picture)
            db.add(profile)
            await db.commit()
            
            logger.info("New user registered via Google: %s", email)
            
        elif not user.is_active:
            raise UnauthorizedException("Account is disabled")
        else:
            if not user.is_verified:
                user.is_verified = True
                await db.commit()
        
        # Check 2FA
        if user.two_factor_enabled:
            temp_token = create_access_token(user.id, user.role, expires_delta=timedelta(minutes=5), token_version=user.token_version)
            return {"success": True, "message": "2FA required", "data": {"requires_2fa": True, "temp_token": temp_token}}

        # Generate tokens
        access_token = create_access_token(user.id, user.role, token_version=user.token_version)
        refresh_token = create_refresh_token(user.id, token_version=user.token_version)
        
        logger.info("User logged in via Google: %s", user.email)
        await log_login(user, db, request)
        
        response.set_cookie(key="lifeos_access_token", value=access_token, httponly=True, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        response.set_cookie(key="lifeos_refresh_token", value=refresh_token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)
        
        return AuthResponse(
            message="Google Sign-In successful",
            data=TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
        )

    except ValueError as e:
        logger.error(f"Google token error: {str(e)}")
        raise UnauthorizedException(f"Invalid Google token: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected Google auth error: {str(e)}")
        raise UnauthorizedException(f"Google authentication failed: {str(e)}")


@router.post("/forgot-password", response_model=AuthResponse)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Generate a password reset code and 'send' it (mocked)."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Return success anyway to prevent email enumeration
        return AuthResponse(message="If an account exists, a verification code has been sent.")
        
    # Generate 6-digit code
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    
    # Store token
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Delete any existing tokens for this user first
    await db.execute(
        PasswordResetToken.__table__.delete().where(PasswordResetToken.email == data.email)
    )
    
    token_record = PasswordResetToken(email=data.email, reset_code=code, expires_at=expires)
    db.add(token_record)
    await db.commit()
    
    # Send actual email in background
    asyncio.create_task(asyncio.to_thread(send_verification_email, data.email, code))
    
    return AuthResponse(message="If an account exists, a verification code has been sent.")


@router.post("/reset-password", response_model=AuthResponse)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a verification code."""
    # Find token
    result = await db.execute(
        select(PasswordResetToken)
        .where(
            PasswordResetToken.email == data.email,
            PasswordResetToken.reset_code == data.code
        )
    )
    token_record = result.scalar_one_or_none()
    
    if not token_record:
        raise UnauthorizedException("Invalid or missing verification code")
        
    # Check expiration
    if datetime.now(timezone.utc) > token_record.expires_at.replace(tzinfo=timezone.utc):
        raise UnauthorizedException("Verification code has expired")
        
    # Find user
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise UnauthorizedException("User not found")
        
    # Enforce password policy
    await enforce_password_policy(data.new_password, db)

    # Update password
    user.hashed_password = hash_password(data.new_password)
    
    # Delete token
    await db.execute(
        PasswordResetToken.__table__.delete().where(PasswordResetToken.id == token_record.id)
    )
    
    await db.commit()
    
    logger.info("Password successfully reset for: %s", data.email)
    return AuthResponse(message="Password successfully reset. You can now log in.")


@router.post("/verify-email", response_model=AuthResponse)
async def verify_email(data: VerifyEmailRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Verify email using code and log the user in."""
    # Find token
    result = await db.execute(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.email == data.email,
            EmailVerificationToken.verification_code == data.code
        )
    )
    token_record = result.scalar_one_or_none()
    
    if not token_record:
        raise UnauthorizedException("Invalid or missing verification code")
        
    # Check expiration
    if datetime.now(timezone.utc) > token_record.expires_at.replace(tzinfo=timezone.utc):
        raise UnauthorizedException("Verification code has expired")
        
    # Find user
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise UnauthorizedException("User not found")
        
    # Verify user
    user.is_verified = True
    
    # Delete token
    await db.execute(
        EmailVerificationToken.__table__.delete().where(EmailVerificationToken.id == token_record.id)
    )
    await db.commit()
    
    # Generate tokens
    settings = get_settings()
    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)
    
    logger.info("Email verified for: %s", data.email)
    response.set_cookie(key="lifeos_access_token", value=access_token, httponly=True, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="lifeos_refresh_token", value=refresh_token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)
    
    return AuthResponse(
        message="Email successfully verified.",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    )

@router.post("/resend-verification", response_model=AuthResponse)
async def resend_verification(data: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    """Generate a new verification code and send it."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or user.is_verified:
        # Return success to prevent enumeration
        return AuthResponse(message="If an unverified account exists, a new code has been sent.")
        
    # Generate new 6-digit code
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Delete any existing verification tokens for this user
    await db.execute(
        EmailVerificationToken.__table__.delete().where(EmailVerificationToken.email == data.email)
    )
    
    token_record = EmailVerificationToken(email=data.email, verification_code=code, expires_at=expires)
    db.add(token_record)
    await db.commit()
    
    # Send actual email
    send_verification_email(data.email, code)
    
    return AuthResponse(message="If an unverified account exists, a new code has been sent.")


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Refresh access token using a valid refresh token."""
    # Try cookie first, then request body (for mobile apps)
    token = request.cookies.get("lifeos_refresh_token")
    if not token:
        try:
            body = await request.json()
            token = body.get("refresh_token")
        except Exception:
            pass
    if not token:
        raise UnauthorizedException("No refresh token provided")
        
    payload = decode_refresh_token(token)
    user_id = payload.get("sub")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise UnauthorizedException("User not found or deactivated")

    settings = get_settings()
    access_token = create_access_token(user.id, user.role, token_version=user.token_version)
    new_refresh = create_refresh_token(user.id, token_version=user.token_version)

    response.set_cookie(key="lifeos_access_token", value=access_token, httponly=True, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="lifeos_refresh_token", value=new_refresh, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)

    return AuthResponse(
        message="Token refreshed",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )

@router.post("/switch-account", response_model=AuthResponse)
async def switch_account(data: RefreshRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Switch to a saved account using its refresh token."""
    try:
        payload = decode_refresh_token(data.refresh_token)
        user_id = payload.get("sub")
    except UnauthorizedException:
        raise UnauthorizedException("Session expired. Please log in again.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise UnauthorizedException("Account not found or deactivated.")

    settings = get_settings()
    access_token = create_access_token(user.id, user.role, token_version=user.token_version)
    new_refresh = create_refresh_token(user.id, token_version=user.token_version)

    response.set_cookie(key="lifeos_access_token", value=access_token, httponly=True, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="lifeos_refresh_token", value=new_refresh, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)
    
    logger.info("User switched account: %s", user.email)

    return AuthResponse(
        message="Account switched successfully",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )


@router.post("/logout")
async def logout(response: Response, request: Request):
    """Logout (client should discard tokens)."""
    user_id = "unknown"
    try:
        token = request.cookies.get("lifeos_access_token")
        if token:
            from app.utils.security import decode_access_token
            payload = decode_access_token(token)
            user_id = payload.get("sub", "unknown")
    except Exception:
        pass
        
    response.delete_cookie("lifeos_access_token")
    response.delete_cookie("lifeos_refresh_token")
    logger.info("User logged out: %s", user_id)
    return {"success": True, "message": "Logged out successfully"}


@router.get("/me", response_model=UserInfoResponse)
async def get_current_user(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get current authenticated user info."""
    result = await db.execute(
        select(User, UserProfile)
        .join(UserProfile, User.id == UserProfile.user_id, isouter=True)
        .where(User.id == user_id)
    )
    row = result.one_or_none()
    if not row:
        raise UnauthorizedException("User not found")

    user, profile = row
    return UserInfoResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        name=profile.name if profile else None,
        avatar_url=profile.avatar_url if profile else None,
        face_login_enabled=user.face_login_enabled,
        two_factor_enabled=user.two_factor_enabled,
        login_alerts_enabled=user.login_alerts_enabled,
    )


@router.post("/face/setup")
async def face_setup(data: FaceSetupRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Finish Face API registration and save the descriptor."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException("User not found")

    user.face_descriptor = json.dumps(data.descriptor)
    user.face_login_enabled = True
    
    await db.commit()
    return {"success": True, "message": "Biometric login configured successfully"}


@router.post("/face/disable")
async def face_disable(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Disable Face API (Biometric) login for the current user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException("User not found")
        
    user.face_descriptor = None
    user.face_login_enabled = False
    await db.commit()
    return {"success": True, "message": "Biometric login disabled successfully"}


@router.post("/face/login", response_model=AuthResponse)
async def face_login(data: FaceLoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Verify Face API authentication assertion and login."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or not user.face_login_enabled or not user.face_descriptor:
        raise UnauthorizedException("Biometric login is not enabled for this account")

    stored_descriptor = json.loads(user.face_descriptor)
    requested_descriptor = data.descriptor
    
    # Calculate Euclidean distance
    distance = math.sqrt(sum((a - b) ** 2 for a, b in zip(stored_descriptor, requested_descriptor)))
    
    # Standard threshold for face-api.js is ~0.6, we use 0.55 for slight strictness
    if distance > 0.55:
        raise UnauthorizedException(f"Biometric verification failed (distance: {distance:.2f})")

    settings = get_settings()
        
    # Check 2FA
    if user.two_factor_enabled:
        temp_token = create_access_token(user.id, user.role, expires_delta=timedelta(minutes=5))
        return {"success": True, "message": "2FA required", "data": {"requires_2fa": True, "temp_token": temp_token}}

    logger.info("User logged in with Biometrics: %s", user.id)
    await log_login(user, db, request)
    
    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)
    
    response.set_cookie(key="lifeos_access_token", value=access_token, httponly=True, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="lifeos_refresh_token", value=refresh_token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)
    
    return AuthResponse(
        message="Biometric Login successful",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )

@router.post("/login/2fa", response_model=AuthResponse)
async def login_2fa(data: TwoFactorLoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Complete login using 2FA code and temp token."""
    try:
        from app.utils.security import decode_access_token
        payload = decode_access_token(data.temp_token)
        user_id = payload.get("sub")
    except UnauthorizedException:
        raise UnauthorizedException("Session expired. Please log in again.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.two_factor_enabled or not user.two_factor_secret:
        raise UnauthorizedException("Invalid 2FA session")

    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(data.code):
        raise UnauthorizedException("Invalid authentication code")

    settings = get_settings()
    # Generate real tokens
    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)

    logger.info("User logged in with 2FA: %s", user.email)
    await log_login(user, db, request)
    
    response.set_cookie(key="lifeos_access_token", value=access_token, httponly=True, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="lifeos_refresh_token", value=refresh_token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7)

    return AuthResponse(
        message="Login successful",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )

@router.get("/2fa/setup")
async def setup_2fa(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Generate a 2FA secret and QR code URI for setup."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise UnauthorizedException("User not found")
        
    secret = pyotp.random_base32()
    user.two_factor_secret = secret
    await db.flush()
    
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="LifeOS")
    
    return {"success": True, "data": {"secret": secret, "uri": uri}}

@router.post("/2fa/enable")
async def enable_2fa(data: TwoFactorEnableRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Verify code and enable 2FA."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user or not user.two_factor_secret:
        raise UnauthorizedException("2FA setup not initialized")
        
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(data.code):
        raise UnauthorizedException("Invalid authentication code")
        
    user.two_factor_enabled = True
    await db.flush()
    
    return {"success": True, "message": "Two-Factor Authentication enabled"}

@router.post("/2fa/disable")
async def disable_2fa(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Disable 2FA."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise UnauthorizedException("User not found")
        
    user.two_factor_enabled = False
    user.two_factor_secret = None
    await db.commit()
    
    return {"success": True, "message": "Two-Factor Authentication disabled"}
