from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.medicine import Medicine
from app.models.reminder import MedicineDose, ReminderAction, ReminderNotice
from app.services.reminders import settings_for, materialize, dose_json, aware, refill_notices, scheduled_instant, occurs

router = APIRouter(prefix="/reminders", tags=["Medicine reminders"])
UTC = timezone.utc


def validate_zone(value):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("Choose a valid IANA timezone")
    return value


class MedicineOptions(BaseModel):
    threshold: int = Field(default=5, ge=0, le=10000)
    units_per_dose: int = Field(default=1, ge=1, le=100)
    refill_enabled: bool = True


class SettingsInput(BaseModel):
    timezone: str
    enabled: bool = True
    grace_minutes: int = Field(default=120, ge=15, le=1440)
    delivery: str = Field(default="server", pattern="^(server|device)$")
    device_id: str | None = Field(default=None, max_length=80)
    overrides: dict[str, MedicineOptions] = Field(default_factory=dict, max_length=500)
    _zone = field_validator("timezone")(validate_zone)


class DoseInput(BaseModel):
    action_id: str = Field(min_length=16, max_length=80)
    status: str = Field(pattern="^(taken|skipped|snoozed|pending)$")
    minutes: int = Field(default=15, ge=1, le=60)
    reason: str = Field(default="", max_length=500)
    occurred_at: datetime

    @field_validator("occurred_at")
    @classmethod
    def timestamp(cls, value):
        if value.tzinfo is None or value > datetime.now(UTC) + timedelta(minutes=2):
            raise ValueError("Action time must be timezone-aware and not in the future")
        return value


class RefillInput(BaseModel):
    action_id: str = Field(min_length=16, max_length=80)
    quantity: int = Field(ge=1, le=10000)


def settings_json(s):
    return {"timezone": s.timezone, "enabled": s.enabled, "grace_minutes": s.grace_minutes,
            "delivery": s.delivery, "device_id": s.device_id, "overrides": s.overrides or {}}


@router.get("")
async def summary(user_id: CurrentUserId, timezone_name: str = Query("UTC", alias="timezone"),
                  db: AsyncSession = Depends(get_db)):
    try:
        validate_zone(timezone_name)
    except ValueError as e:
        raise HTTPException(422, str(e))
    settings = await settings_for(db, user_id, timezone_name)
    meds, doses = await materialize(db, settings)
    await refill_notices(db, settings, meds)
    today = datetime.now(ZoneInfo(settings.timezone)).date().isoformat()
    # Native recurrence uses the same local-calendar rules as the server.
    rules = [{"id": m.id, "name": m.name, "dosage": m.dosage, "times": m.times,
              "frequency": m.frequency, "start_date": str(m.start_date or aware(m.created_at).date()),
              "end_date": str(m.end_date) if m.end_date else None}
             for m in meds if m.is_active and m.frequency != "as_needed"]
    await db.commit()
    return {"user_id": user_id, "settings": settings_json(settings), "today": today,
            "doses": [dose_json(d, settings) for d in sorted(doses, key=lambda d: aware(d.scheduled_at), reverse=True)
                      if d.status != "cancelled"], "rules": rules, "medicines": meds}


@router.put("/settings")
async def update_settings(data: SettingsInput, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    settings = await settings_for(db, user_id, data.timezone)
    if data.delivery == "device" and not data.device_id:
        raise HTTPException(422, "A device identifier is required")
    for key, value in data.model_dump().items():
        setattr(settings, key, value)
    await materialize(db, settings)
    await db.commit()
    return settings_json(settings)


@router.post("/doses/{dose_id}/action")
async def act(dose_id: str, data: DoseInput, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    settings = await settings_for(db, user_id)
    previous = await db.get(ReminderAction, data.action_id)
    if previous:
        if previous.user_id != user_id or previous.dose_id != dose_id:
            raise HTTPException(409, "Action identifier already used")
        return {"success": True, "replayed": True}
    dose = await db.get(MedicineDose, dose_id)
    if dose and dose.user_id != user_id:
        raise HTTPException(404, "Dose not found")
    # An offline native notification can be older than the materialized window.
    if not dose:
        try:
            medicine_id, local_day, hour, minute = dose_id.split(":")
            day, clock = date.fromisoformat(local_day), f"{hour}:{minute}"
            med = await db.get(Medicine, medicine_id)
            if not med or med.user_id != user_id or not occurs(med, day) or clock not in med.times:
                raise ValueError()
            instant = scheduled_instant(day, clock, settings.timezone)
            if instant < aware(settings.created_at) or instant > datetime.now(UTC) + timedelta(days=2):
                raise ValueError()
            dose = MedicineDose(id=dose_id, user_id=user_id, medicine_id=med.id, name=med.name,
                dosage=med.dosage, local_date=local_day, local_time=clock, timezone=settings.timezone,
                scheduled_at=instant, status="pending", stock_used=0)
            db.add(dose)
            await db.flush()
        except (ValueError, TypeError):
            raise HTTPException(404, "Dose is no longer in the medicine schedule")
    if dose.status == "cancelled":
        raise HTTPException(409, "This dose was cancelled")
    db.add(ReminderAction(id=data.action_id, user_id=user_id, dose_id=dose_id))
    if dose.acted_at and data.occurred_at < aware(dose.acted_at):
        await db.commit()
        return {"success": True, "superseded": True}
    med = (await db.execute(select(Medicine).where(Medicine.id == dose.medicine_id,
            Medicine.user_id == user_id).with_for_update())).scalar_one_or_none()
    if data.status == "snoozed":
        if data.occurred_at < aware(dose.scheduled_at) - timedelta(minutes=1):
            raise HTTPException(422, "Only a due dose can be snoozed")
        if dose.status in ("taken", "skipped"):
            raise HTTPException(409, "Reset a completed dose before snoozing")
    units = (settings.overrides or {}).get(dose.medicine_id, {}).get("units_per_dose", 1)
    used = (dose.stock_used if dose.status == "taken" else units) if data.status == "taken" and med and med.type in ("tablet", "capsule") else 0
    # Keep exact consumption for reversals; lack of stock must not block a dose log.
    if med:
        available = med.remaining + dose.stock_used
        actual_used = min(used, available)
        med.remaining = available - actual_used
        dose.stock_used = actual_used
    dose.status, dose.acted_at, dose.reason = data.status, data.occurred_at, data.reason
    dose.snoozed_until = data.occurred_at + timedelta(minutes=data.minutes) if data.status == "snoozed" else None
    if data.status == "snoozed":
        dose.notified_at, dose.push_attempts = None, 0
    if med:
        await refill_notices(db, settings, [med])
    await db.commit()
    return {"success": True, "dose": dose_json(dose, settings)}


@router.post("/medicines/{medicine_id}/refill")
async def refill(medicine_id: str, data: RefillInput, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    settings = await settings_for(db, user_id)
    old = await db.get(ReminderAction, data.action_id)
    if old:
        if old.user_id != user_id or old.dose_id != f"refill:{medicine_id}":
            raise HTTPException(409, "Action identifier already used")
        return {"success": True}
    med = (await db.execute(select(Medicine).where(Medicine.id == medicine_id,
            Medicine.user_id == user_id).with_for_update())).scalar_one_or_none()
    if not med:
        raise HTTPException(404, "Medicine not found")
    med.remaining += data.quantity
    med.total_pills = max(med.total_pills, med.remaining)
    db.add(ReminderAction(id=data.action_id, user_id=user_id, dose_id=f"refill:{medicine_id}"))
    await refill_notices(db, settings, [med])
    await db.commit()
    return {"success": True, "remaining": med.remaining}


@router.get("/notifications")
async def notifications(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(ReminderNotice).where(ReminderNotice.user_id == user_id,
            ReminderNotice.read == False).order_by(ReminderNotice.created_at.desc()).limit(100))).scalars().all()


@router.post("/notifications/{notice_id}/read")
async def read_notice(notice_id: str, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    notice = await db.get(ReminderNotice, notice_id)
    if not notice or notice.user_id != user_id:
        raise HTTPException(404, "Notification not found")
    notice.read = True
    await db.commit()
    return {"success": True}
