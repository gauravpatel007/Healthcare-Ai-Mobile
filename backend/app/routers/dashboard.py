"""
LifeOS Backend — Dashboard Router
Aggregated health dashboard data.
"""

import asyncio
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.appointment import Appointment
from app.models.family import FamilyMember
from app.models.medical_record import MedicalRecord
from app.models.medicine import Medicine
from app.models.user import User, UserProfile
from app.schemas.dashboard import DashboardSummary
from app.utils.helpers import calculate_bmi, calculate_health_score, get_bmi_category

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get aggregated dashboard data.  All queries run in parallel."""
    # Build all queries up front
    user_query = (
        select(User, UserProfile)
        .join(UserProfile, User.id == UserProfile.user_id, isouter=True)
        .where(User.id == user_id)
    )
    meds_query = select(Medicine).where(Medicine.user_id == user_id, Medicine.is_active == True)
    apts_query = (
        select(Appointment).where(
            Appointment.user_id == user_id,
            Appointment.status == "upcoming",
            Appointment.date >= date.today(),
        ).order_by(Appointment.date)
    )
    records_query = select(func.count(MedicalRecord.id)).where(MedicalRecord.user_id == user_id)
    family_query = select(FamilyMember).where(FamilyMember.user_id == user_id)

    # Execute all 5 queries in parallel
    user_r, meds_r, apts_r, records_r, family_r = await asyncio.gather(
        db.execute(user_query),
        db.execute(meds_query),
        db.execute(apts_query),
        db.execute(records_query),
        db.execute(family_query),
    )

    # Process results
    row = user_r.first()
    if row:
        user_obj, profile = row
        if profile and profile.name and profile.name.strip() and profile.name != "User":
            name = profile.name
        else:
            name = user_obj.email.split("@")[0].capitalize()
    else:
        profile = None
        name = "User"
        
    bmi = calculate_bmi(profile.weight, profile.height) if profile else 0
    blood_type = profile.blood_type if profile else "O+"

    meds = meds_r.scalars().all()
    apts = apts_r.scalars().all()
    records_count = records_r.scalar() or 0
    family = family_r.scalars().all()

    # Health score
    health_score = calculate_health_score(bmi, len(meds), len(apts))

    # Build reminders from medicines
    reminders = [
        {"name": m.name, "dosage": m.dosage, "frequency": m.frequency, "time": m.times[0] if m.times else "Flexible"}
        for m in meds[:4]
    ]

    # Build upcoming
    upcoming = [
        {"doctor": a.doctor, "specialty": a.specialty, "hospital": a.hospital,
         "date": str(a.date), "time": str(a.time)}
        for a in apts[:3]
    ]

    # Build family summary
    family_summary = [
        {"name": f.name, "avatar": f.avatar, "conditions": f.conditions or []}
        for f in family[:3]
    ]

    # Water intake (Defaulting to 0 for now as there's no water tracking table)
    water = 0

    return DashboardSummary(
        health_score=health_score,
        active_medicines=len(meds),
        upcoming_appointments=len(apts),
        water_intake=water,
        medical_records=records_count,
        bmi=bmi,
        bmi_category=get_bmi_category(bmi),
        blood_type=blood_type,
        user_name=name,
        reminders=reminders,
        upcoming=upcoming,
        family_summary=family_summary,
    )
