"""
LifeOS Backend — Appointments Router
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.exceptions import NotFoundException
from app.models.appointment import Appointment
from app.models.health_tracker import HealthEntry
from app.models.user import UserProfile
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, AppointmentUpdate, AppointmentSuggestion, AppointmentPrepRequest
from app.services.ai_service import generate_ai_response

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("", response_model=list[AppointmentResponse])
async def list_appointments(
    user_id: CurrentUserId,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List appointments with optional status filter."""
    query = select(Appointment).where(Appointment.user_id == user_id)
    if status:
        query = query.where(Appointment.status == status)
    query = query.order_by(Appointment.date)
    result = await db.execute(query)
    return result.scalars().all()


from fastapi import BackgroundTasks

@router.post("", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    data: AppointmentCreate, 
    user_id: CurrentUserId, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Schedule a new appointment."""
    apt = Appointment(user_id=user_id, **data.model_dump())
    db.add(apt)
    await db.flush()
    await db.refresh(apt)
    
    # Check notification preferences
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    
    if profile and profile.notification_preferences and profile.notification_preferences.get("appointment", {}).get("emergency_sms", False):
        from app.models.emergency import EmergencyContact
        from app.utils.email import send_sos_sms_twilio
        
        # Get emergency contacts
        contacts_res = await db.execute(select(EmergencyContact).where(EmergencyContact.user_id == user_id))
        contacts = contacts_res.scalars().all()
        phones = [c.phone for c in contacts if c.phone]
        
        if phones:
            msg = f"LifeOS Alert: {profile.name} has scheduled a new medical appointment with {apt.doctor} on {apt.date} at {apt.time}."
            background_tasks.add_task(send_sos_sms_twilio, phones, profile.name, msg)

    await db.commit()
    return apt


@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str, data: AppointmentUpdate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Update an appointment."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.user_id == user_id)
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise NotFoundException("Appointment", appointment_id)

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(apt, key, value)
    
    await db.commit()
    await db.refresh(apt)
    return apt


@router.post("/{appointment_id}/prep", response_model=AppointmentResponse)
async def generate_appointment_prep(
    appointment_id: str,
    request: AppointmentPrepRequest,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db)
):
    """Generate AI prep questions for an appointment based on recent health data."""
    # 1. Fetch appointment
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.user_id == user_id)
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise NotFoundException("Appointment", appointment_id)

    # 2. Fetch recent vitals (last 14 days)
    from datetime import datetime, timedelta, timezone
    fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
    vitals_res = await db.execute(
        select(HealthEntry).where(
            HealthEntry.user_id == user_id,
            HealthEntry.recorded_at >= fourteen_days_ago
        )
    )
    vitals = vitals_res.scalars().all()
    
    # Format vitals to a readable string
    vitals_text = "No recent vitals recorded."
    if vitals:
        vitals_dict = {}
        for v in vitals:
            if v.category not in vitals_dict:
                vitals_dict[v.category] = []
            val_str = f"{v.value}"
            if v.secondary_value:
                val_str += f"/{v.secondary_value}"
            vitals_dict[v.category].append(val_str)
        
        vitals_text = "\n".join([f"- {k.replace('_', ' ').title()}: {', '.join(v[-3:])}" for k, v in vitals_dict.items()])

    # 3. Construct AI Prompt
    symptoms_text = request.symptoms if request.symptoms else "None reported."
    requested_lang = "English"
    if request.language and request.language.lower() not in ['en', 'english']:
        requested_lang = request.language.upper()
    lang_instruction = f"\n\nCRITICAL INSTRUCTION: Output your final response entirely in {requested_lang}."

    prompt = f"""
You are an expert AI medical assistant helping a patient prepare for an upcoming doctor's appointment.

APPOINTMENT DETAILS:
- Doctor: {apt.doctor}
- Specialty: {apt.specialty}
- Notes/Reason: {apt.notes or "Not specified"}

PATIENT'S RECENT DATA:
- Symptoms: {symptoms_text}
- Recent Vitals (last 14 days):
{vitals_text}

TASK:
Based on the appointment reason, the recent symptoms, and the vitals provided, draft a list of 3 to 5 highly relevant and important questions the patient should ask their doctor during the visit.
Ensure the questions are patient-friendly, clear, and focused on understanding their health, potential treatments, and next steps.
Format the output as a clear bulleted list using markdown. Do not include any greeting or conversational filler, just the questions and a very brief rationale for each if helpful.{lang_instruction}
    """

    # 4. Generate AI Response
    generated_text = await generate_ai_response("assistant", prompt, max_tokens=600)
    
    # 5. Save to database
    apt.ai_prep_notes = generated_text.strip()
    await db.commit()
    await db.refresh(apt)
    
    return apt


@router.delete("/{appointment_id}", status_code=204)
async def delete_appointment(appointment_id: str, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Cancel/delete an appointment."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.user_id == user_id)
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise NotFoundException("Appointment", appointment_id)
    await db.delete(apt)
    return {"success": True, "message": "Appointment cancelled"}


@router.get("/suggestions", response_model=list[AppointmentSuggestion])
async def appointment_suggestions(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get AI-generated appointment suggestions based on profile."""
    profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()
    
    conditions = profile.conditions if profile and profile.conditions else []
    age = profile.age if profile and profile.age else 30
    gender = profile.gender if profile and profile.gender else "Male"

    suggestions = []
    
    # Base suggestions
    suggestions.append(AppointmentSuggestion(text="Schedule an annual health checkup", specialist="General Physician", urgency="Medium"))
    suggestions.append(AppointmentSuggestion(text="Dental cleaning recommended every 6 months", specialist="Dentist", urgency="Low"))
    
    # Age-based suggestions
    if age >= 40:
        suggestions.append(AppointmentSuggestion(text="Annual eye examination due", specialist="Ophthalmologist", urgency="Medium"))
    if age >= 50:
        suggestions.append(AppointmentSuggestion(text="Routine colonoscopy screening", specialist="Gastroenterologist", urgency="High"))
        
    # Gender-based suggestions
    if gender.lower() == "female" and age >= 21:
        suggestions.append(AppointmentSuggestion(text="Annual well-woman exam", specialist="Gynecologist", urgency="Medium"))
        
    # Condition-based suggestions
    cond_lower = [c.lower() for c in conditions]
    if any("asthma" in c for c in cond_lower):
        suggestions.insert(0, AppointmentSuggestion(
            text="Regular pulmonology follow-up recommended", specialist="Pulmonologist", urgency="Medium"
        ))
    if any("diabetes" in c for c in cond_lower):
        suggestions.insert(0, AppointmentSuggestion(
            text="HbA1c check and endocrinology follow-up", specialist="Endocrinologist", urgency="High"
        ))
    if any("hypertension" in c or "blood pressure" in c for c in cond_lower):
        suggestions.insert(0, AppointmentSuggestion(
            text="Blood pressure monitoring and cardio check", specialist="Cardiologist", urgency="High"
        ))

    return suggestions[:4]  # Return top 4 most relevant suggestions
