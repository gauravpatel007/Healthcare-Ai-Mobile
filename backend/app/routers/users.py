"""
LifeOS Backend — User Profile Router
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.exceptions import NotFoundException
from app.models.user import UserProfile
from app.models.disease import DiseaseLibrary
from app.models.file_asset import FileAsset
from app.schemas.user import UserProfileResponse, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get current user's profile."""
    from sqlalchemy import text
    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN step_goal INTEGER NOT NULL DEFAULT 10000;"))
        await db.commit()
    except Exception:
        await db.rollback()
        
    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN target_weight FLOAT;"))
        await db.commit()
    except Exception:
        await db.rollback()

    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN target_weight_timeline VARCHAR(100);"))
        await db.commit()
    except Exception:
        await db.rollback()

    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN calorie_goal INTEGER;"))
        await db.commit()
    except Exception:
        await db.rollback()

    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN burn_calorie_goal INTEGER NOT NULL DEFAULT 500;"))
        await db.commit()
    except Exception:
        await db.rollback()

    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN measurement_unit VARCHAR(10) NOT NULL DEFAULT 'metric';"))
        await db.commit()
    except Exception:
        await db.rollback()
        
    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN notification_preferences JSON NOT NULL DEFAULT '{}';"))
        await db.commit()
    except Exception:
        await db.rollback()
        
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Profile")
        
    from app.models.health_tracker import HealthEntry
    
    # Auto-sync weight from the latest HealthEntry to resolve out-of-sync states
    latest_weight_res = await db.execute(
        select(HealthEntry)
        .where(HealthEntry.user_id == user_id, HealthEntry.category == "weight")
        .order_by(HealthEntry.recorded_at.desc())
        .limit(1)
    )
    latest_w = latest_weight_res.scalars().first()
    if latest_w and latest_w.value != profile.weight:
        profile.weight = latest_w.value
        db.add(profile)
        
    await db.commit()
    return profile


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    data: UserProfileUpdate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Update current user's profile."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Profile")

    update_data = data.model_dump(exclude_unset=True)
    old_weight = profile.weight
    
    for key, value in update_data.items():
        setattr(profile, key, value)
        
    if data.burn_calorie_goal is not None:
        profile.burn_calorie_goal = data.burn_calorie_goal


    new_weight = update_data.get("weight")
    if new_weight is not None and new_weight != old_weight:
        from app.models.health_tracker import HealthEntry
        from datetime import datetime, timezone
        
        # Add a new health entry for the updated weight
        label = datetime.now(timezone.utc).strftime("%b")
        entry = HealthEntry(
            user_id=user_id,
            category="weight",
            value=new_weight,
            label=label,
            recorded_at=datetime.now(timezone.utc)
        )
        db.add(entry)

    # Auto-save new conditions to DiseaseLibrary
    new_conditions = update_data.get("conditions")
    if new_conditions:
        from sqlalchemy import func
        for condition_name in new_conditions:
            lib_query = select(DiseaseLibrary).where(func.lower(DiseaseLibrary.name) == condition_name.lower())
            lib_result = await db.execute(lib_query)
            if not lib_result.scalar_one_or_none():
                new_disease = DiseaseLibrary(name=condition_name)
                db.add(new_disease)

    await db.flush()
    await db.commit()
    return profile


@router.get("/export")
async def export_data(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Export all user data as JSON."""
    try:
        from fastapi.encoders import jsonable_encoder
        from app.models.medical_record import MedicalRecord
        from app.models.medicine import Medicine
        from app.models.appointment import Appointment
        from app.models.emergency import EmergencyContact
        from app.models.family import FamilyMember, Vaccination
        from app.models.expense import MedicalExpense

        profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        profile = profile_r.scalar_one_or_none()

        records_r = await db.execute(select(MedicalRecord).where(MedicalRecord.user_id == user_id))
        meds_r = await db.execute(select(Medicine).where(Medicine.user_id == user_id))
        apts_r = await db.execute(select(Appointment).where(Appointment.user_id == user_id))
        contacts_r = await db.execute(select(EmergencyContact).where(EmergencyContact.user_id == user_id))
        family_r = await db.execute(select(FamilyMember).where(FamilyMember.user_id == user_id))
        vax_r = await db.execute(select(Vaccination).where(Vaccination.user_id == user_id))
        expenses_r = await db.execute(select(MedicalExpense).where(MedicalExpense.user_id == user_id))

        raw_data = {
            "profile": {col.key: getattr(profile, col.key) for col in UserProfile.__table__.columns} if profile else {},
            "records": [{col.key: getattr(r, col.key) for col in MedicalRecord.__table__.columns} for r in records_r.scalars().all()],
            "medicines": [{col.key: getattr(m, col.key) for col in Medicine.__table__.columns} for m in meds_r.scalars().all()],
            "appointments": [{col.key: getattr(a, col.key) for col in Appointment.__table__.columns} for a in apts_r.scalars().all()],
            "contacts": [{col.key: getattr(c, col.key) for col in EmergencyContact.__table__.columns} for c in contacts_r.scalars().all()],
            "family": [{col.key: getattr(f, col.key) for col in FamilyMember.__table__.columns} for f in family_r.scalars().all()],
            "vaccinations": [{col.key: getattr(v, col.key) for col in Vaccination.__table__.columns} for v in vax_r.scalars().all()],
            "expenses": [{col.key: getattr(e, col.key) for col in MedicalExpense.__table__.columns} for e in expenses_r.scalars().all()],
            "message": "Full data export.",
        }
        
        # Explicitly encode to catch serialization errors here rather than in Starlette middleware
        encoded = jsonable_encoder(raw_data)
        return encoded
        
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger("lifeos.users")
        logger.error(f"Export Error: {str(e)}\n{traceback.format_exc()}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Export Error: {str(e)}")


@router.get("/security/login-history")
async def get_login_history(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get the 5 most recent login events."""
    from app.models.user import LoginHistory
    result = await db.execute(
        select(LoginHistory)
        .where(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.created_at.desc())
        .limit(5)
    )
    history = result.scalars().all()
    return {
        "success": True,
        "data": [
            {
                "id": h.id,
                "ip_address": h.ip_address,
                "user_agent": h.user_agent,
                "created_at": h.created_at.isoformat()
            }
            for h in history
        ]
    }


@router.put("/security/alerts-toggle")
async def toggle_login_alerts(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Toggle the login alerts enabled setting for the user."""
    from app.models.user import User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        from app.exceptions import UnauthorizedException
        raise UnauthorizedException("User not found")
        
    user.login_alerts_enabled = not user.login_alerts_enabled
    await db.flush()
    await db.commit()
    
    return {
        "success": True, 
        "message": "Login alerts updated successfully",
        "data": {"login_alerts_enabled": user.login_alerts_enabled}
    }


@router.post("/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
    file: __import__("fastapi").UploadFile = __import__("fastapi").File(...)
):
    """Upload and set the user's avatar image."""
    import shutil
    import os
    import time
    from pathlib import Path
    from app.config import get_settings
    
    settings = get_settings()
    
    # Verify profile exists
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        from app.exceptions import NotFoundException
        raise NotFoundException("Profile")
        
    # Validate extension
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid image format. Allowed: jpg, png, gif, webp")
        
    # Create directory
    avatar_dir = Path(settings.UPLOAD_DIR) / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    filename = f"avatar_{user_id}_{int(time.time())}.{ext}"
    file_path = avatar_dir / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Remove old avatar if it exists and is not a default/external URL
    if profile.avatar_url and profile.avatar_url.startswith("/uploads/avatars/"):
        old_filename = profile.avatar_url.split("/")[-1]
        old_path = avatar_dir / old_filename
        if old_path.exists():
            try:
                os.remove(old_path)
            except Exception:
                pass
                
    # Update profile
    profile.avatar_url = f"/uploads/avatars/{filename}"
    
    # Save as FileAsset
    file_size = os.path.getsize(file_path)
    new_asset = FileAsset(
        name=f"Profile Avatar - {profile.name}",
        type=file.content_type or f"image/{ext}",
        category="Images",
        size_bytes=file_size,
        file_path=profile.avatar_url
    )
    db.add(new_asset)
    
    await db.flush()
    await db.commit()
    
    return profile


from pydantic import BaseModel

class DeviceTokenUpdate(BaseModel):
    token: str

@router.put("/me/device-token")
async def update_device_token(
    data: DeviceTokenUpdate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Register or update the user's push notification device token."""
    from sqlalchemy import text
    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN push_device_token VARCHAR(255);"))
        await db.commit()
    except Exception:
        await db.rollback()

    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        from app.exceptions import NotFoundException
        raise NotFoundException("Profile")
        
    profile.push_device_token = data.token
    await db.commit()
    
    return {"success": True, "message": "Device token registered"}

@router.post("/me/test-push")
async def test_push_notification(
    user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Send a test push notification to the user's registered device."""
    from fastapi import HTTPException
    import traceback
    
    try:
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        profile = result.scalar_one_or_none()
        
        if not profile or not profile.push_device_token:
            raise HTTPException(status_code=400, detail="No push device token found. Please subscribe first.")
        
        token = profile.push_device_token
        
        # Inline the push notification logic here for better error visibility
        import urllib.request
        import json as json_lib
        from app.config import get_settings
        
        settings = get_settings()
        app_id = settings.ONESIGNAL_APP_ID.strip('"').strip("'")
        rest_api_key = settings.ONESIGNAL_REST_API_KEY.strip('"').strip("'")
        
        if not app_id or not rest_api_key:
            raise HTTPException(
                status_code=500, 
                detail=f"OneSignal not configured. app_id='{app_id}', key_prefix='{rest_api_key[:20] if rest_api_key else 'EMPTY'}'"
            )
        
        url = "https://onesignal.com/api/v1/notifications"
        payload = {
            "app_id": app_id,
            "target_channel": "push",
            "include_subscription_ids": [token],
            "headings": {"en": "Test Notification 🚀"},
            "contents": {"en": "Your push notifications are working perfectly!"},
        }
        
        req = urllib.request.Request(
            url,
            data=json_lib.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Basic {rest_api_key}"
            },
            method="POST"
        )
        
        with urllib.request.urlopen(req) as response:
            res_data = json_lib.loads(response.read())
            return {"success": True, "message": "Test notification sent", "onesignal_response": res_data}
            
    except HTTPException:
        raise
    except Exception as e:
        error_body = ""
        if hasattr(e, 'read'):
            try:
                error_body = e.read().decode()
            except Exception:
                pass
        full_error = f"{str(e)} | Body: {error_body}" if error_body else str(e)
        raise HTTPException(status_code=500, detail=f"Push error: {full_error}")
