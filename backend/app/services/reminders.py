"""Shared calendar rules; all persisted instants are UTC, calendar days use IANA zones."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import select
from app.models.medicine import Medicine, MedicineLog
from app.models.reminder import MedicineDose, ReminderSettings, ReminderNotice

UTC = timezone.utc


def aware(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def scheduled_instant(day, clock, zone):
    # A nonexistent spring-forward time moves forward by the DST gap; repeated
    # fall-back times fire once, using the earlier offset (fold=0).
    local = datetime.combine(day, time.fromisoformat(clock), ZoneInfo(zone))
    return local.astimezone(UTC)


def occurs(med, day):
    if not med.is_active or med.frequency == "as_needed":
        return False
    start = med.start_date or aware(med.created_at).date()
    if day < start or (med.end_date and day > med.end_date):
        return False
    return med.frequency != "once_weekly" or (day - start).days % 7 == 0


def dose_status(dose, settings, now=None):
    now = now or datetime.now(UTC)
    if dose.status not in ("pending", "snoozed"):
        return dose.status
    due = aware(dose.snoozed_until or dose.scheduled_at)
    if now > due + timedelta(minutes=settings.grace_minutes):
        return "missed"
    if dose.status == "snoozed" and now < due:
        return "snoozed"
    return "due" if due <= now else "upcoming"


def dose_json(dose, settings):
    return {"id": dose.id, "medicine_id": dose.medicine_id, "name": dose.name,
            "dosage": dose.dosage, "scheduled_at": aware(dose.scheduled_at).isoformat(),
            "date": dose.local_date, "time": dose.local_time, "timezone": dose.timezone,
            "status": dose_status(dose, settings), "reason": dose.reason, "stock_used": dose.stock_used,
            "acted_at": aware(dose.acted_at).isoformat() if dose.acted_at else None,
            "snoozed_until": aware(dose.snoozed_until).isoformat() if dose.snoozed_until else None}


async def settings_for(db, user_id, zone="UTC", lock=True):
    # Serialize this user's scheduler/actions, including first-time creation.
    from app.models.user import User
    if lock:
        await db.execute(select(User.id).where(User.id == user_id).with_for_update())
    settings = await db.get(ReminderSettings, user_id)
    if not settings:
        settings = ReminderSettings(user_id=user_id, timezone=zone)
        db.add(settings)
        await db.flush()
    return settings


async def materialize(db, settings, now=None):
    now = now or datetime.now(UTC)
    today = now.astimezone(ZoneInfo(settings.timezone)).date()
    first = max(today - timedelta(days=30), aware(settings.created_at).astimezone(ZoneInfo(settings.timezone)).date())
    meds = (await db.execute(select(Medicine).where(Medicine.user_id == settings.user_id))).scalars().all()
    existing = (await db.execute(select(MedicineDose).where(MedicineDose.user_id == settings.user_id,
                  MedicineDose.local_date >= first.isoformat()))).scalars().all()
    by_id = {d.id: d for d in existing}
    legacy = (await db.execute(select(MedicineLog).where(MedicineLog.user_id == settings.user_id,
                MedicineLog.date >= first))).scalars().all()
    old = {(l.medicine_id, str(l.date), l.scheduled_time): l.status for l in legacy}
    expected = set()
    for med in meds:
        for offset in range((today - first).days + 3):
            day = first + timedelta(days=offset)
            if not occurs(med, day):
                continue
            for clock in sorted(set(med.times or [])):
                try:
                    instant = scheduled_instant(day, clock, settings.timezone)
                except (ValueError, TypeError):
                    continue
                key = f"{med.id}:{day.isoformat()}:{clock}"
                expected.add(key)
                dose = by_id.get(key)
                if not dose:
                    # Activation never invents missed doses from earlier today.
                    if instant < aware(settings.created_at) and (med.id, str(day), clock) not in old:
                        continue
                    dose = MedicineDose(id=key, user_id=settings.user_id, medicine_id=med.id,
                        name=med.name, dosage=med.dosage, scheduled_at=instant,
                        local_date=str(day), local_time=clock, timezone=settings.timezone,
                        status=old.get((med.id, str(day), clock), "pending"))
                    db.add(dose)
                    by_id[key] = dose
                elif dose.status in ("pending", "cancelled") and aware(dose.scheduled_at) > now:
                    dose.scheduled_at, dose.timezone = instant, settings.timezone
                    dose.name, dose.dosage, dose.status = med.name, med.dosage, "pending"
    for dose in existing:
        if dose.id not in expected and dose.status in ("pending", "snoozed"):
            # Only cancel future doses. Past unrecorded doses remain in history.
            active_ids = {m.id for m in meds if m.is_active}
            if (aware(dose.scheduled_at) > now or dose.medicine_id not in active_ids or
                    (dose.snoozed_until and aware(dose.snoozed_until) > now)):
                dose.status = "cancelled"
    await db.flush()
    return meds, list(by_id.values())


async def refill_notices(db, settings, meds):
    for med in meds:
        opts = (settings.overrides or {}).get(med.id, {})
        key = f"refill:{med.id}"
        notice = await db.get(ReminderNotice, key)
        if not med.is_active or med.type not in ("tablet", "capsule") or not opts.get("refill_enabled", True):
            if notice: await db.delete(notice)
            continue
        low = med.remaining <= opts.get("threshold", 5)
        if low and not notice:
            db.add(ReminderNotice(id=key, user_id=settings.user_id, title=f"Refill {med.name}",
                message=f"{med.remaining} units remaining. Check your supply and arrange a refill."))
        elif not low and notice:
            await db.delete(notice)
