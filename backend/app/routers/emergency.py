"""
LifeOS Backend — Emergency Router
Emergency contacts, SOS, QR health card, organ donor.
"""

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Request
import os
import shutil
from app.config import get_settings
# pyrefly: ignore [missing-import]
from sqlalchemy import select
# pyrefly: ignore [missing-import]
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
from app.routers.emergency_consent import router as consent_router, contact_response, reset_consent
from app.services.emergency_alerts import dispatch_consented_sos
import asyncio

router = APIRouter(prefix="/emergency", tags=["Emergency"])
router.include_router(consent_router)


async def audio_clip_response(clip):
    from app.utils.twilio_support import public_audio_url, audio_url_problem
    settings = get_settings()
    response = SOSAudioClipResponse.model_validate(clip)
    if not os.path.isfile(os.path.join(settings.UPLOAD_DIR, clip.file_path)):
        problem = "The saved recording file is missing from the server. Please select and upload the audio again."
    else:
        url = public_audio_url(settings.PUBLIC_API_URL, clip.file_path)
        problem = await asyncio.to_thread(audio_url_problem, url)
    response.call_audio_ready = problem is None
    response.call_audio_message = problem or "Recording address is reachable. During the call, press any key once to play it."
    return response


@router.get("/contacts", response_model=list[EmergencyContactResponse])
async def list_contacts(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == user_id)
    )
    return [await contact_response(contact, db) for contact in result.scalars().all()]


@router.post("/contacts", response_model=EmergencyContactResponse, status_code=201)
async def create_contact(data: EmergencyContactCreate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    contact = EmergencyContact(user_id=user_id, **data.model_dump())
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    return await contact_response(contact, db)


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
    changes = data.model_dump(exclude_unset=True)
    if any(key in changes and changes[key] != getattr(contact, key) for key in ("name", "phone", "email")):
        await reset_consent(contact.id, db)
    for key, value in changes.items():
        setattr(contact, key, value)
    await db.flush()
    await db.refresh(contact)
    return await contact_response(contact, db)


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
    """Only accepted accounts receive app/email alerts; link consent never enables calls."""
    return await dispatch_consented_sos(request, user_id, db)


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
    return await audio_clip_response(clip)


@router.get("/sos-audio", response_model=SOSAudioClipResponse)
async def get_sos_audio(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get the user's custom SOS audio clip."""
    result = await db.execute(select(SOSAudioClip).where(SOSAudioClip.user_id == user_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(404, "No SOS audio clip found.")
    return await audio_clip_response(clip)


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


@router.api_route("/echo-twiml", methods=["GET", "POST"])
async def echo_twiml(twiml: str, request: Request):
    """Echo endpoint for Twilio TwiML playback logic without external dependencies."""
    # pyrefly: ignore [missing-import]
    from fastapi import Response
    from app.utils.twilio_support import render_voice_twiml
    digits = request.query_params.get('Digits')
    if request.method == 'POST':
        form = await request.form()
        digits = form.get('Digits') or digits
    try:
        content = render_voice_twiml(twiml, digits)
    except ValueError:
        raise HTTPException(400, 'Invalid voice instructions')
    return Response(content=content, media_type="application/xml", headers={'Cache-Control': 'no-store'})


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
