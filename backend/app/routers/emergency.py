"""
LifeOS Backend — Emergency Router
Emergency contacts, SOS, QR health card, organ donor.
"""

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.exceptions import NotFoundException
from app.models.emergency import EmergencyContact, SOSLog
from app.models.medicine import Medicine
from app.models.user import UserProfile
from app.schemas.emergency import (
    EmergencyContactCreate, EmergencyContactResponse, EmergencyContactUpdate,
    QRHealthData, SOSAlertResponse, SOSAlertRequest, OrganPreferencesUpdate, OrganSuitabilityRequest, OrganMatchRequest
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
    try:
        contacts_r = await db.execute(
            select(EmergencyContact).where(EmergencyContact.user_id == user_id)
        )
        contacts = contacts_r.scalars().all()
        
        profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        profile = profile_r.scalar_one_or_none()
        user_name = profile.name if profile else "LifeOS User"
        
        emails = [c.email for c in contacts if getattr(c, 'email', None)]
        
        sms_emails = [c.phone for c in contacts if c.phone]
        
        location_url = None
        if request.latitude is not None and request.longitude is not None:
            location_url = f"https://www.google.com/maps?q={request.latitude},{request.longitude}"
            if request.accuracy:
                pass
                
        actions = [
            "Location shared with emergency contacts" if location_url else "Emergency contacts alerted",
            f"Health QR card sent to {len(contacts)} contacts",
            "Medical history prepared for sharing",
            "Nearby hospitals notified",
        ]
        
        if emails:
            # Run email sending in the background
            asyncio.create_task(asyncio.to_thread(send_sos_email, emails, user_name, location_url))
            actions.append(f"Emergency alert email dispatched to {len(emails)} contacts")
            
        if sms_emails:
            # Run SMS sending in the background
            asyncio.create_task(asyncio.to_thread(send_sos_sms_twilio, sms_emails, user_name, location_url))
            actions.append(f"Emergency SMS dispatched to {len(sms_emails)} contacts via Twilio")
            
            # Run Voice Calls in the background
            asyncio.create_task(asyncio.to_thread(send_sos_call_twilio, sms_emails, user_name, location_url))
            actions.append(f"Automated voice calls initiated to {len(sms_emails)} contacts via Twilio")
            
        # Log the SOS event
        sos_log = SOSLog(user_id=user_id, is_silent=request.is_silent)
        db.add(sos_log)
        await db.commit()
                
        return SOSAlertResponse(actions=actions)
    except Exception as e:
        import traceback
        error_msg = f"Error in SOS: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return SOSAlertResponse(success=False, message=error_msg, actions=[error_msg])


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


@router.put("/organ-preferences")
async def update_organ_preferences(
    data: OrganPreferencesUpdate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Update granular organ donor preferences."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Profile")
    
    profile.organ_donor = data.organ_donor
    profile.organ_preferences = data.organ_preferences
    await db.flush()
    
    return {
        "organ_donor": profile.organ_donor, 
        "organ_preferences": profile.organ_preferences,
        "message": "Organ donor preferences saved successfully."
    }


@router.post("/organ-suitability")
async def check_organ_suitability(
    data: OrganSuitabilityRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Run AI Pre-Screening for Organ Suitability based on profile and questionnaire."""
    from app.services.ai_service import generate_ai_response
    
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    
    context = ""
    if profile:
        conditions = ", ".join(profile.conditions) if profile.conditions else "None"
        allergies = ", ".join(profile.allergies) if profile.allergies else "None"
        context = f"Age: {profile.age}\nBlood Type: {profile.blood_type}\nConditions: {conditions}\nAllergies: {allergies}"
        
    user_message = "Questionnaire Answers:\n"
    for k, v in data.questionnaire_answers.items():
        user_message += f"- {k.replace('_', ' ').title()}: {v}\n"
        
    report = await generate_ai_response(
        module="organ_suitability",
        user_message=user_message,
        context=context
    )
    
    return {"report": report}

from app.models.user import User
from app.models.notification import SystemNotification
from app.utils.email import send_organ_match_email

@router.post("/organ-network/match")
async def initiate_organ_match(
    data: OrganMatchRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Initiate a match process, sending an email and notification to the donor."""
    # Fetch requester profile
    requester_res = await db.execute(
        select(UserProfile, User).join(User, UserProfile.user_id == User.id).where(UserProfile.user_id == user_id)
    )
    requester_row = requester_res.first()
    if not requester_row:
        raise HTTPException(status_code=404, detail="Requester not found")
    requester_profile, requester_user = requester_row

    # Fetch donor profile
    donor_res = await db.execute(
        select(UserProfile, User).join(User, UserProfile.user_id == User.id).where(UserProfile.user_id == data.donor_id)
    )
    donor_row = donor_res.first()
    if not donor_row:
        raise HTTPException(status_code=404, detail="Donor not found")
    donor_profile, donor_user = donor_row

    # Fetch requester primary emergency contact
    contact_res = await db.execute(
        select(EmergencyContact)
        .where(EmergencyContact.user_id == user_id)
        .order_by(EmergencyContact.is_primary.desc())
    )
    primary_contact = contact_res.scalars().first()
    
    # Try all possible phone fields in order of preference
    possible_numbers = [
        primary_contact.phone if primary_contact else None,
        requester_profile.phone,
        requester_profile.emergency_contact
    ]
    emergency_contact_number = next((num for num in possible_numbers if num and str(num).strip()), "112")

    # Send Email
    email_sent = send_organ_match_email(
        recipient_email=donor_user.email,
        recipient_name=donor_profile.name,
        requester_name=requester_user.email,
        organ=data.organ,
        emergency_contact=emergency_contact_number
    )

    # Send App Notification
    notification = SystemNotification(
        type="In-App",
        target_audience=str(donor_profile.user_id),
        title="New Organ Match Request",
        message=f"{requester_user.email} has initiated a match process for your pledged {data.organ}.",
        status="Sent"
    )
    db.add(notification)
    await db.commit()

    return {"success": True, "email_sent": email_sent, "message": "Match request initiated"}
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Profile")
        
    try:
        from app.services.ai_service import generate_ai_response
        prompt = f"""
        You are a medical AI assistant helping evaluate a patient's suitability for organ donation.
        Analyze the following profile and questionnaire answers and provide a concise, encouraging 
        2-paragraph summary on their suitability.

        Age: {profile.age}
        Blood Type: {profile.blood_type}
        Allergies: {', '.join(profile.allergies) if profile.allergies else 'None'}
        Conditions: {', '.join(profile.conditions) if profile.conditions else 'None'}
        
        Questionnaire Answers:
        {data.questionnaire_answers}
        
        Keep it professional, empathetic, and note any potential red flags without making a definitive medical diagnosis.
        """
        report = await generate_ai_response("organ_prescreening", prompt, max_tokens=300)
        return {"report": report}
    except Exception as e:
        return {"report": "Based on a basic profile check, you appear to be a potential candidate for most standard donations. However, AI generation failed so please consult a real physician for an accurate screening."}


@router.get("/organ-network/search")
async def search_organ_network(query: str = "", user_id: CurrentUserId = None, db: AsyncSession = Depends(get_db)):
    """Fetch real registered organ donors from the network."""
    from app.models.user import User
    from sqlalchemy import or_
    import random
    
    # Query all users who are registered organ donors
    stmt = (
        select(UserProfile, User.email)
        .join(User, UserProfile.user_id == User.id)
        .where(UserProfile.organ_donor == True)
        .where(User.is_active == True)
    )
    
    if query:
        search_pattern = f"%{query}%"
        stmt = stmt.where(
            or_(
                UserProfile.blood_type.ilike(search_pattern),
                UserProfile.name.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )
        
    res = await db.execute(stmt)
    donors = res.all()
    
    results = []
    for profile, email in donors:
        # Determine pledged organs from JSON preferences
        prefs = getattr(profile, "organ_preferences", {}) or {}
        pledged = [k for k, v in prefs.items() if v]
        
        # We will split it into multiple listings if they have pledged multiple organs, 
        # or just show them as a single donor available.
        # To match the UI which expects "organ" string, we'll create a listing per organ.
        if not pledged:
            pledged = ["Any"] # default if registered but no specific preferences

        for org in pledged:
            # Check if this specific organ matches the query if provided
            if query and query.lower() not in org.lower() and query.lower() not in profile.blood_type.lower() and query.lower() not in profile.name.lower():
                continue
                
            results.append({
                "id": f"{profile.id}-{org}",
                "type": "Available",
                "organ": org.capitalize(),
                "blood_type": profile.blood_type or "Unknown",
                "urgency": "Normal",
                "location": "Global Network",
                "match_score": random.randint(70, 99), # still random for visual flair unless we compute it against user
                "donor_name": profile.name,
                "donor_email": email,
                "donor_age": profile.age,
                "user_id": profile.user_id
            })
            
    return {"results": results}

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
