"""
LifeOS Backend — Emergency Router
Emergency contacts, SOS, QR health card, organ donor.
"""

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
import os
import shutil
from app.config import get_settings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.exceptions import NotFoundException
from app.models.emergency import EmergencyContact, SOSLog, SOSAudioClip
from app.models.medicine import Medicine
from app.models.user import UserProfile
from app.schemas.emergency import (
    EmergencyContactCreate, EmergencyContactResponse, EmergencyContactUpdate,
    QRHealthData, SOSAlertResponse, SOSAlertRequest, OrganPreferencesUpdate, OrganSuitabilityRequest, OrganMatchRequest, SOSAudioClipResponse
)
from app.utils.email import send_sos_email, send_sos_sms_twilio, send_sos_call_twilio
import asyncio

router = APIRouter(prefix="/emergency", tags=["Emergency"])


@router.get("/contacts", response_model=list[EmergencyContactResponse])
async def list_contacts(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == user_id)
    )
    return result.scalars().all()


@router.post("/contacts", response_model=EmergencyContactResponse, status_code=201)
async def create_contact(data: EmergencyContactCreate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    contact = EmergencyContact(user_id=user_id, **data.model_dump())
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    return contact


@router.put("/contacts/{contact_id}", response_model=EmergencyContactResponse)
async def update_contact(
    contact_id: str, data: EmergencyContactUpdate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.id == contact_id, EmergencyContact.user_id == user_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise NotFoundException("Emergency contact", contact_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)
    await db.flush()
    await db.refresh(contact)
    return contact


@router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.id == contact_id, EmergencyContact.user_id == user_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise NotFoundException("Emergency contact", contact_id)
    await db.delete(contact)
    return {"success": True, "message": "Contact deleted"}


@router.post("/sos", response_model=SOSAlertResponse)
async def trigger_sos(request: SOSAlertRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Trigger SOS emergency alert."""
    import logging
    logger = logging.getLogger("lifeos.emergency")

    try:
        contacts_r = await db.execute(
            select(EmergencyContact).where(EmergencyContact.user_id == user_id)
        )
        contacts = contacts_r.scalars().all()
        
        profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        profile = profile_r.scalar_one_or_none()
        user_name = profile.name if profile else "LifeOS User"
        
        # Log the SOS event FIRST — this is the critical action
        sos_log = SOSLog(user_id=user_id, is_silent=request.is_silent)
        db.add(sos_log)
        await db.commit()
        
        emails = [c.email for c in contacts if getattr(c, 'email', None)]
        phone_numbers = [c.phone for c in contacts if c.phone]
        
        location_url = None
        if request.latitude is not None and request.longitude is not None:
            location_url = f"https://www.google.com/maps?q={request.latitude},{request.longitude}"
                
        # Attempt notifications as best-effort (don't block success on these)
        actions_taken = []
        accepted_count = 0
        tasks = []
        if emails:
            tasks.append(asyncio.to_thread(send_sos_email, emails, user_name, location_url))
        if phone_numbers:
            tasks.append(asyncio.to_thread(send_sos_sms_twilio, phone_numbers, user_name, location_url))
            
            # Fetch Custom Audio Clip URL
            audio_url = None
            clip_r = await db.execute(select(SOSAudioClip).where(SOSAudioClip.user_id == user_id))
            clip = clip_r.scalar_one_or_none()
            if clip:
                settings = get_settings()
                from app.utils.twilio_support import public_audio_url
                audio_url = public_audio_url(settings.PUBLIC_API_URL, clip.file_path)
                if not audio_url:
                    logger.warning("Custom SOS audio has no public origin; using spoken alert")
                
            tasks.append(asyncio.to_thread(send_sos_call_twilio, phone_numbers, user_name, location_url, audio_url))
        if tasks:
            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        err = f"SOS notification task {i} exception: {result}"
                        logger.error(err)
                        actions_taken.append("SOS notification failed. Please call your contact directly.")
                    elif isinstance(result, tuple) and len(result) == 2:
                        success, msg = result
                        accepted_count += int(bool(success))
                        actions_taken.append(msg if success else f"Notification failed: {msg}")
                    elif result:
                        accepted_count += 1
                        actions_taken.append("Notification request accepted")
                    else:
                        actions_taken.append("Notification failed silently")
            except Exception as notify_err:
                logger.error(f"SOS notification dispatch error: {notify_err}")
        
        if not actions_taken:
            actions_taken.append("SOS logged. Notifications could not be delivered — please call your emergency contact directly.")
        
        return SOSAlertResponse(
            success=accepted_count > 0,
            message="Notification requests submitted; delivery is not confirmed." if accepted_count else "SOS recorded, but notifications failed. Please call your contact directly.",
            actions=actions_taken,
        )
    except Exception as e:
        import logging as _log
        _log.getLogger("lifeos.emergency").error(f"SOS endpoint error: {e}", exc_info=True)
        # Never expose traceback to frontend
        return SOSAlertResponse(success=False, message="An internal error occurred. Please call emergency services directly.", actions=[])


@router.get("/qr-data", response_model=QRHealthData)
async def get_qr_data(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get health data for QR code generation."""
    profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()

    meds_r = await db.execute(select(Medicine).where(Medicine.user_id == user_id, Medicine.is_active == True))
    meds = meds_r.scalars().all()

    contacts_r = await db.execute(select(EmergencyContact).where(EmergencyContact.user_id == user_id))
    contacts = contacts_r.scalars().all()

    return QRHealthData(
        name=profile.name if profile else "User",
        blood_type=profile.blood_type if profile else "O+",
        age=profile.age if profile else 0,
        gender=profile.gender if profile else "Unknown",
        allergies=profile.allergies if profile else [],
        conditions=profile.conditions if profile else [],
        medicines=[m.name for m in meds],
        emergency_contacts=[{"name": c.name, "phone": c.phone, "relation": c.relation} for c in contacts],
        organ_donor=profile.organ_donor if profile else False,
        organ_preferences=profile.organ_preferences if profile and getattr(profile, "organ_preferences", None) else {},
    )


@router.post("/sos-audio", response_model=SOSAudioClipResponse)
async def upload_sos_audio(
    user_id: CurrentUserId,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a custom audio clip for SOS calls."""
    settings = get_settings()
    
    # Ensure directory exists
    audio_dir = os.path.join(settings.UPLOAD_DIR, "sos_audio")
    os.makedirs(audio_dir, exist_ok=True)
    
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp3", ".wav", ".ogg"]:
        raise HTTPException(400, "Only MP3, WAV, and OGG files are supported.")
    
    # Save file
    filename = f"{user_id}{ext}"
    file_path = os.path.join(audio_dir, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # DB Record
    relative_path = f"sos_audio/{filename}"
    result = await db.execute(select(SOSAudioClip).where(SOSAudioClip.user_id == user_id))
    clip = result.scalar_one_or_none()
    
    if clip:
        clip.file_path = relative_path
        clip.original_filename = file.filename
    else:
        clip = SOSAudioClip(
            user_id=user_id,
            file_path=relative_path,
            original_filename=file.filename
        )
        db.add(clip)
        
    await db.commit()
    await db.refresh(clip)
    return clip


@router.get("/sos-audio", response_model=SOSAudioClipResponse)
async def get_sos_audio(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get the user's custom SOS audio clip."""
    result = await db.execute(select(SOSAudioClip).where(SOSAudioClip.user_id == user_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(404, "No SOS audio clip found.")
    return clip


@router.delete("/sos-audio")
async def delete_sos_audio(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Delete the user's custom SOS audio clip."""
    result = await db.execute(select(SOSAudioClip).where(SOSAudioClip.user_id == user_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(404, "No SOS audio clip found.")
    
    settings = get_settings()
    file_path = os.path.join(settings.UPLOAD_DIR, clip.file_path)
    if os.path.exists(file_path):
        os.remove(file_path)
        
    await db.delete(clip)
    await db.commit()
    return {"success": True, "message": "Audio clip deleted successfully"}


# Active SOS sessions for live tracking
active_sos_sessions = {}

@router.websocket("/ws/{session_id}")
async def websocket_sos_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket for live location and secret audio streaming during an active SOS.
    """
    await websocket.accept()
    active_sos_sessions[session_id] = websocket
    print(f"[SOS] Session {session_id} connected for live tracking.")
    try:
        while True:
            import json
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
                if data.get("type") == "location":
                    print(f"[SOS Live Location] {session_id} -> Lat: {data.get('latitude')}, Lng: {data.get('longitude')}")
                elif data.get("type") == "audio_chunk":
                    # In a real app, this would be appended to a file or streamed to S3
                    print(f"[SOS Secret Audio] {session_id} -> Received chunk size: {len(data.get('data', ''))}")
            except Exception:
                pass
    except WebSocketDisconnect:
        if session_id in active_sos_sessions:
            del active_sos_sessions[session_id]
        print(f"[SOS] Session {session_id} tracking ended.")
