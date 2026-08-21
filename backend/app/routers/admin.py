from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, func, cast, Date as SADate, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone, date

from app.database import get_db
from app.models.user import User, UserProfile, LoginHistory
from app.models.appointment import Appointment
from app.models.emergency import EmergencyContact, SOSLog, AITriageLog
from app.models.chat import ChatMessage
from app.models.medicine import Medicine
from app.models.health_tracker import HealthEntry
from app.models.mood import MoodEntry
from app.models.medical_record import MedicalRecord
from app.models.admin import AIUsageLog
from app.models.disease import SymptomCheckHistory
from app.utils.security import hash_password

router = APIRouter(prefix="/admin", tags=["Admin"])

class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str


@router.get("/stats")
async def get_admin_stats(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # ─── USERS ───────────────────────────────────────────────────
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0

    # Active today: users with a login_history record today
    active_today = (await db.execute(
        select(func.count(func.distinct(LoginHistory.user_id)))
        .where(LoginHistory.created_at >= today_start)
    )).scalar() or 0

    weekly_active = (await db.execute(
        select(func.count(func.distinct(LoginHistory.user_id)))
        .where(LoginHistory.created_at >= week_ago)
    )).scalar() or 0

    monthly_active = (await db.execute(
        select(func.count(func.distinct(LoginHistory.user_id)))
        .where(LoginHistory.created_at >= month_ago)
    )).scalar() or 0

    new_registrations = (await db.execute(
        select(func.count(User.id))
        .where(User.created_at >= week_ago)
    )).scalar() or 0

    # ─── HEALTH STATISTICS ───────────────────────────────────────
    symptom_scans = (await db.execute(
        select(func.count(SymptomCheckHistory.id))
    )).scalar() or 0

    medical_reports = (await db.execute(
        select(func.count(MedicalRecord.id))
    )).scalar() or 0


    mood_entries = (await db.execute(
        select(func.count(MoodEntry.id))
    )).scalar() or 0

    workout_sessions = (await db.execute(
        select(func.count(HealthEntry.id))
        .where(HealthEntry.category.in_(["calories", "steps"]))
    )).scalar() or 0


    medication_logs = (await db.execute(
        select(func.count(Medicine.id))
    )).scalar() or 0

    ai_conversations = (await db.execute(
        select(func.count(ChatMessage.id))
    )).scalar() or 0

    # ─── AI ANALYTICS ────────────────────────────────────────────
    ai_requests_today = (await db.execute(
        select(func.count(AIUsageLog.id))
        .where(AIUsageLog.created_at >= today_start)
    )).scalar() or 0

    avg_response = (await db.execute(
        select(func.avg(AIUsageLog.response_time_ms))
    )).scalar()
    avg_response_time_ms = round(avg_response) if avg_response else 0

    failed_requests = (await db.execute(
        select(func.count(AIUsageLog.id))
        .where(AIUsageLog.error_message.isnot(None))
    )).scalar() or 0

    prompt_sum = (await db.execute(
        select(func.coalesce(func.sum(AIUsageLog.prompt_tokens), 0))
    )).scalar() or 0
    completion_sum = (await db.execute(
        select(func.coalesce(func.sum(AIUsageLog.completion_tokens), 0))
    )).scalar() or 0
    total_tokens = prompt_sum + completion_sum

    # Top AI features
    top_features_q = await db.execute(
        select(AIUsageLog.feature, func.count(AIUsageLog.id).label("cnt"))
        .group_by(AIUsageLog.feature)
        .order_by(func.count(AIUsageLog.id).desc())
        .limit(5)
    )
    top_features = [{"name": r[0], "count": r[1]} for r in top_features_q.all()]

    # Top diseases (approximate from symptom chat messages)
    # We'll just return the count per module as a proxy
    top_modules_q = await db.execute(
        select(ChatMessage.module, func.count(ChatMessage.id).label("cnt"))
        .where(ChatMessage.role == "user")
        .group_by(ChatMessage.module)
        .order_by(func.count(ChatMessage.id).desc())
        .limit(5)
    )
    top_diseases = [{"name": r[0].capitalize(), "count": r[1]} for r in top_modules_q.all()]

    # ─── CHART DATA (Last 30 days) ───────────────────────────────
    chart_days = []
    for i in range(29, -1, -1):
        d = (now - timedelta(days=i)).date()
        chart_days.append(d)

    async def count_by_day(model, date_col, extra_filter=None):
        """Return a list of {date, count} for last 30 days."""
        results = []
        for d in chart_days:
            d_start = datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)
            d_end = d_start + timedelta(days=1)
            q = select(func.count(model.id)).where(date_col >= d_start, date_col < d_end)
            if extra_filter is not None:
                q = q.where(extra_filter)
            val = (await db.execute(q)).scalar() or 0
            results.append({"date": d.isoformat(), "count": val})
        return results

    async def count_by_day_date_col(model, date_col):
        """For models with Date column instead of DateTime."""
        results = []
        for d in chart_days:
            val = (await db.execute(
                select(func.count(model.id)).where(date_col == d)
            )).scalar() or 0
            results.append({"date": d.isoformat(), "count": val})
        return results

    user_growth = await count_by_day(User, User.created_at)
    daily_logins = await count_by_day(LoginHistory, LoginHistory.created_at)
    mood_trends = await count_by_day(MoodEntry, MoodEntry.created_at)
    ai_usage = await count_by_day(ChatMessage, ChatMessage.created_at)
    workout_usage = await count_by_day(HealthEntry, HealthEntry.recorded_at, HealthEntry.category.in_(["calories", "steps"]))

    # ─── Appointments & Emergency (existing) ─────────────────────
    total_appts = (await db.execute(select(func.count(Appointment.id)))).scalar() or 0
    total_emerg = (await db.execute(select(func.count(SOSLog.id)))).scalar() or 0

    return {
        "users": {
            "total": total_users,
            "active_today": active_today,
            "weekly_active": weekly_active,
            "monthly_active": monthly_active,
            "new_registrations": new_registrations,
            "online": max(1, active_today),  # approximation
        },
        "health": {
            "symptom_scans": symptom_scans,
            "medical_reports": medical_reports,
            "mood_entries": mood_entries,
            "workout_sessions": workout_sessions,
            "medication_logs": medication_logs,
            "ai_conversations": ai_conversations,
        },
        "ai": {
            "requests_today": ai_requests_today,
            "avg_response_time_ms": avg_response_time_ms,
            "failed_requests": failed_requests,
            "total_tokens": total_tokens,
            "top_features": top_features,
            "top_diseases": top_diseases,
        },
        "charts": {
            "user_growth": user_growth,
            "daily_logins": daily_logins,
            "mood_trends": mood_trends,
            "ai_usage": ai_usage,
            "workout_usage": workout_usage,
        },
        # Keep legacy flat fields for backward compat
        "total_users": total_users,
        "active_users": weekly_active,
        "total_appointments": total_appts,
        "emergency_events": total_emerg,
        "ai_conversations": ai_conversations,
        "medication_adherence": 94.2,
        "system_health": 99.9,
    }

@router.get("/users")
async def get_admin_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User, UserProfile).outerjoin(UserProfile, User.id == UserProfile.user_id).order_by(User.created_at.desc())
    )
    users = []
    for u, p in result.all():
        # Get login count & last login
        login_count_q = await db.execute(
            select(func.count(LoginHistory.id)).where(LoginHistory.user_id == u.id)
        )
        login_count = login_count_q.scalar() or 0
        last_login_q = await db.execute(
            select(LoginHistory.created_at).where(LoginHistory.user_id == u.id).order_by(LoginHistory.created_at.desc()).limit(1)
        )
        last_login_row = last_login_q.scalar_one_or_none()

        users.append({
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "is_verified": u.is_verified,
            "is_deleted": u.is_deleted,
            "is_phone_verified": u.is_phone_verified,
            "created_at": str(u.created_at),
            "name": p.name if p else "User",
            "avatar_url": p.avatar_url if p else None,
            "phone": p.phone if p else None,
            "login_count": login_count,
            "last_login": str(last_login_row) if last_login_row else None,
        })
    return users

@router.get("/health/triage-logs")
async def get_triage_logs(db: AsyncSession = Depends(get_db)):
    """Fetch AI Triage Logs for Health Services dashboard."""
    try:
        query = (
            select(AITriageLog, User, UserProfile)
            .join(User, AITriageLog.user_id == User.id)
            .outerjoin(UserProfile, User.id == UserProfile.user_id)
            .order_by(AITriageLog.created_at.desc())
            .limit(50)
        )
        result = await db.execute(query)
        rows = result.all()
        
        return [
            {
                "id": log.id,
                "user_name": profile.name if profile else user.email,
                "user_email": user.email,
                "symptom": log.symptom,
                "response": log.response,
                "created_at": log.created_at
            }
            for log, user, profile in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/users/{user_id}/status")
async def toggle_user_status(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = not user.is_active
    await db.commit()
    return {"id": user.id, "is_active": user.is_active}

@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_admin_user(data: AdminUserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    profile = UserProfile(user_id=user.id, name=data.name)
    db.add(profile)
    await db.commit()

    return {
        "success": True, 
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "name": data.name
        }
    }

@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_admin_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.delete(user)
    await db.commit()
    return {"success": True, "message": "User deleted successfully"}
# ══════════════════════════════════════════════════════════════════
#  MEDICAL RECORDS MANAGEMENT
# ══════════════════════════════════════════════════════════════════

@router.get("/medical-records")
async def admin_get_medical_records(db: AsyncSession = Depends(get_db)):
    """Get all medical records across the platform."""
    from app.models.medical_record import MedicalRecord
    from app.models.user import User, UserProfile
    
    result = await db.execute(
        select(MedicalRecord, User, UserProfile)
        .join(User, MedicalRecord.user_id == User.id)
        .outerjoin(UserProfile, User.id == UserProfile.user_id)
        .order_by(MedicalRecord.created_at.desc())
    )
    
    records = []
    for mr, u, p in result.all():
        d = {col.key: getattr(mr, col.key) for col in mr.__table__.columns}
        d['date'] = str(d['date']) if d['date'] else None
        d['created_at'] = str(d['created_at'])
        d['user_name'] = p.name if p else u.email
        d['user_email'] = u.email
        records.append(d)
    return records

@router.put("/medical-records/{record_id}/status")
async def admin_update_record_status(record_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Approve or reject a record."""
    from app.models.medical_record import MedicalRecord
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record.status = data.get("status", "approved")
    await db.commit()
    return {"success": True, "status": record.status}

@router.put("/medical-records/{record_id}/soft-delete")
async def admin_soft_delete_record(record_id: str, db: AsyncSession = Depends(get_db)):
    """Mark record as deleted."""
    from app.models.medical_record import MedicalRecord
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record.is_deleted = True
    await db.commit()
    return {"success": True, "is_deleted": True}

@router.put("/medical-records/{record_id}/restore")
async def admin_restore_record(record_id: str, db: AsyncSession = Depends(get_db)):
    """Restore a deleted record."""
    from app.models.medical_record import MedicalRecord
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record.is_deleted = False
    await db.commit()
    return {"success": True, "is_deleted": False}

@router.delete("/medical-records/{record_id}")
async def admin_hard_delete_record(record_id: str, db: AsyncSession = Depends(get_db)):
    """Permanently delete a record."""
    from app.models.medical_record import MedicalRecord
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    await db.delete(record)
    await db.commit()
    return {"success": True, "message": "Record deleted"}

@router.put("/medical-records/{record_id}/file")
async def admin_replace_record_file(record_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Replace the file of a medical record."""
    from app.models.medical_record import MedicalRecord
    from app.services import file_service
    
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
        
    file_path = await file_service.save_upload_file(file, record.user_id)
    record.file_path = file_path
    await db.commit()
    return {"success": True, "file_path": file_path}

# ══════════════════════════════════════════════════════════════════
#  SMART TRACKERS DASHBOARD
# ══════════════════════════════════════════════════════════════════

@router.get("/trackers/stats")
async def admin_get_tracker_stats(db: AsyncSession = Depends(get_db)):
    """Global aggregations for Smart Trackers."""
    from app.models.health_tracker import HealthEntry, SleepEntry
    from app.models.mood import MoodEntry
    
    # Mood stats
    moods = (await db.execute(select(MoodEntry.mood, func.count(MoodEntry.id)).group_by(MoodEntry.mood))).all()
    mood_dist = [{"mood": m, "count": c} for m, c in moods]
    
    # Sleep stats
    sleep_avg_hrs = (await db.execute(select(func.avg(SleepEntry.hours)))).scalar() or 0
    sleep_avg_qual = (await db.execute(select(func.avg(SleepEntry.quality)))).scalar() or 0
    
    # Health Entry Stats
    vitals_q = await db.execute(
        select(HealthEntry.category, func.count(HealthEntry.id))
        .group_by(HealthEntry.category)
    )
    vitals_dist = [{"category": c, "count": cnt} for c, cnt in vitals_q.all()]

    return {
        "mood": {"distribution": mood_dist},
        "sleep": {"avg_hours": round(sleep_avg_hrs, 1), "avg_quality": round(sleep_avg_qual, 1)},
        "vitals": vitals_dist
    }

@router.get("/trackers/logs/{tracker_type}")
async def admin_get_tracker_logs(tracker_type: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get raw logs for a specific tracker."""
    from app.models.health_tracker import HealthEntry, SleepEntry
    from app.models.mood import MoodEntry
    from app.models.user import User, UserProfile
    
    async def fetch_with_user(model, order_col, extra_filter=None):
        q = select(model, UserProfile.name, User.email).join(User, model.user_id == User.id).outerjoin(UserProfile, User.id == UserProfile.user_id)
        if extra_filter is not None:
            q = q.where(extra_filter)
        q = q.order_by(order_col.desc()).limit(limit)
        res = await db.execute(q)
        
        items = []
        for row, name, email in res.all():
            d = {col.key: getattr(row, col.key) for col in row.__table__.columns}
            for k, v in d.items():
                if hasattr(v, 'isoformat'): d[k] = v.isoformat()
            d['user_name'] = name or email
            items.append(d)
        return items

    if tracker_type == "mood":
        return await fetch_with_user(MoodEntry, MoodEntry.created_at)
    elif tracker_type == "sleep":
        return await fetch_with_user(SleepEntry, SleepEntry.date)
    else:
        # For health entries, the type is the category
        return await fetch_with_user(HealthEntry, HealthEntry.recorded_at, HealthEntry.category == tracker_type)

@router.delete("/trackers/logs/{tracker_type}/{log_id}")
async def admin_delete_tracker_log(tracker_type: str, log_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.health_tracker import HealthEntry, SleepEntry
    from app.models.mood import MoodEntry
    
    model = None
    if tracker_type == "mood": model = MoodEntry
    elif tracker_type == "sleep": model = SleepEntry
    else: model = HealthEntry
    
    result = await db.execute(select(model).where(model.id == log_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Log not found")
        
    await db.delete(entry)
    await db.commit()
    return {"success": True}

# ══════════════════════════════════════════════════════════════════
#  NEW USER MANAGEMENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@router.get("/migrate-ai-models")
async def migrate_ai_models(db: AsyncSession = Depends(get_db)):
    """Temporary endpoint to create ai_prompts and add cols to chat_messages."""
    try:
        # ChatMessage columns
        await db.execute(text('''
            ALTER TABLE chat_messages 
            ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS feedback INTEGER;
        '''))
        
        # Create ai_prompts
        await db.execute(text('''
            CREATE TABLE IF NOT EXISTS ai_prompts (
                id VARCHAR(36) PRIMARY KEY,
                module VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        '''))
        await db.execute(text('''
            CREATE INDEX IF NOT EXISTS ix_ai_prompts_module ON ai_prompts (module);
        '''))
        
        # Create ai_prompt_versions
        await db.execute(text('''
            CREATE TABLE IF NOT EXISTS ai_prompt_versions (
                id VARCHAR(36) PRIMARY KEY,
                prompt_id VARCHAR(36) NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
                module VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                version INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        '''))
        await db.execute(text('''
            CREATE INDEX IF NOT EXISTS ix_ai_prompt_versions_prompt_id ON ai_prompt_versions (prompt_id);
        '''))
        
        await db.commit()
        return {"success": True, "message": "AI Models Schema migrated"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ══════════════════════════════════════════════════════════════════
#  AI CHAT MANAGEMENT
# ══════════════════════════════════════════════════════════════════

@router.get("/chats/analytics")
async def admin_get_chat_analytics(db: AsyncSession = Depends(get_db)):
    from app.models.chat import ChatMessage
    
    # Total conversations (approximated by user messages)
    total_chats = (await db.execute(select(func.count(ChatMessage.id)).where(ChatMessage.role == 'user'))).scalar() or 0
    
    # Module usage distribution
    module_dist_q = await db.execute(select(ChatMessage.module, func.count(ChatMessage.id)).group_by(ChatMessage.module))
    module_dist = [{"module": m, "count": c} for m, c in module_dist_q.all()]
    
    # Average chat length per user (very rough approximation)
    users_with_chats = (await db.execute(select(func.count(func.distinct(ChatMessage.user_id))))).scalar() or 1
    avg_length = total_chats / users_with_chats if users_with_chats > 0 else 0
    
    # Success rate approximation (based on lack of flagged/negative feedback)
    flagged = (await db.execute(select(func.count(ChatMessage.id)).where(ChatMessage.is_flagged == True))).scalar() or 0
    success_rate = 100 if total_chats == 0 else max(0, 100 - ((flagged / total_chats) * 100))

    return {
        "total_chats": total_chats,
        "module_distribution": module_dist,
        "avg_length": round(avg_length, 1),
        "success_rate": round(success_rate, 1),
        "user_satisfaction": 4.8 # Simulated
    }

@router.get("/chats")
async def admin_get_chats(module: str = None, search: str = None, limit: int = 100, db: AsyncSession = Depends(get_db)):
    from app.models.chat import ChatMessage
    from app.models.user import User, UserProfile
    
    q = select(ChatMessage, UserProfile.name, User.email).join(User, ChatMessage.user_id == User.id).outerjoin(UserProfile, User.id == UserProfile.user_id)
    
    if module and module != 'all':
        q = q.where(ChatMessage.module == module)
        
    if search:
        search_term = f"%{search.lower()}%"
        q = q.where(func.lower(ChatMessage.content).like(search_term))
        
    q = q.order_by(ChatMessage.created_at.desc()).limit(limit)
    res = await db.execute(q)
    
    chats = []
    for chat, name, email in res.all():
        d = {col.key: getattr(chat, col.key) for col in chat.__table__.columns}
        d['created_at'] = d['created_at'].isoformat()
        d['user_name'] = name or email
        chats.append(d)
        
    return chats

@router.put("/chats/{chat_id}/flag")
async def admin_flag_chat(chat_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    from app.models.chat import ChatMessage
    res = await db.execute(select(ChatMessage).where(ChatMessage.id == chat_id))
    chat = res.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    chat.is_flagged = data.get("is_flagged", True)
    await db.commit()
    return {"success": True, "is_flagged": chat.is_flagged}

@router.delete("/chats/{chat_id}")
async def admin_delete_chat(chat_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.chat import ChatMessage
    res = await db.execute(select(ChatMessage).where(ChatMessage.id == chat_id))
    chat = res.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    await db.delete(chat)
    await db.commit()
    return {"success": True}

# ══════════════════════════════════════════════════════════════════
#  AI PROMPT MANAGEMENT
# ══════════════════════════════════════════════════════════════════

@router.get("/prompts")
async def admin_get_prompts(db: AsyncSession = Depends(get_db)):
    """Get all active prompts or populate them if empty."""
    from app.models.ai_prompt import AIPrompt
    from app.services.ai_service import SYSTEM_PROMPTS
    
    res = await db.execute(select(AIPrompt).order_by(AIPrompt.module))
    prompts = res.scalars().all()
    
    # Auto-populate if empty
    if not prompts:
        for mod, content in SYSTEM_PROMPTS.items():
            p = AIPrompt(module=mod, name=mod.replace('_', ' ').title() + " Prompt", content=content, version=1)
            db.add(p)
        await db.commit()
        res = await db.execute(select(AIPrompt).order_by(AIPrompt.module))
        prompts = res.scalars().all()
        
    return prompts

@router.put("/prompts/{prompt_id}")
async def admin_update_prompt(prompt_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    from app.models.ai_prompt import AIPrompt, AIPromptVersion
    
    res = await db.execute(select(AIPrompt).where(AIPrompt.id == prompt_id))
    prompt = res.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    new_content = data.get("content")
    if not new_content or new_content == prompt.content:
        return prompt
        
    # Save current version to history
    history = AIPromptVersion(
        prompt_id=prompt.id,
        module=prompt.module,
        content=prompt.content,
        version=prompt.version
    )
    db.add(history)
    
    # Update prompt
    prompt.content = new_content
    prompt.version += 1
    await db.commit()
    await db.refresh(prompt)
    
    return prompt

@router.get("/prompts/{prompt_id}/versions")
async def admin_get_prompt_versions(prompt_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.ai_prompt import AIPromptVersion
    res = await db.execute(select(AIPromptVersion).where(AIPromptVersion.prompt_id == prompt_id).order_by(AIPromptVersion.version.desc()))
    return res.scalars().all()

@router.post("/prompts/{prompt_id}/rollback")
async def admin_rollback_prompt(prompt_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    version_id = data.get("version_id")
    from app.models.ai_prompt import AIPrompt, AIPromptVersion
    
    version_res = await db.execute(select(AIPromptVersion).where(AIPromptVersion.id == version_id, AIPromptVersion.prompt_id == prompt_id))
    version_obj = version_res.scalar_one_or_none()
    if not version_obj:
        raise HTTPException(status_code=404, detail="Version not found")
        
    prompt_res = await db.execute(select(AIPrompt).where(AIPrompt.id == prompt_id))
    prompt = prompt_res.scalar_one_or_none()
    
    # Save current to history
    history = AIPromptVersion(
        prompt_id=prompt.id,
        module=prompt.module,
        content=prompt.content,
        version=prompt.version
    )
    db.add(history)
    
    # Rollback
    prompt.content = version_obj.content
    prompt.version += 1
    await db.commit()
    await db.refresh(prompt)
    
    return prompt

@router.post("/prompts/{module}/test")
async def admin_test_prompt(module: str, data: dict):
    """Test a prompt without saving to DB (or just test the active one)."""
    from app.services.ai_service import generate_ai_response
    test_message = data.get("message", "Hello")
    context = data.get("context", "")
    # Note: this will use the currently active DB prompt since generate_ai_response fetches it
    response = await generate_ai_response(module, test_message, context)
    return {"response": response}

@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, db: AsyncSession = Depends(get_db)):
    """Full user detail for the admin drawer."""
    result = await db.execute(
        select(User, UserProfile).outerjoin(UserProfile, User.id == UserProfile.user_id).where(User.id == user_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    u, p = row

    # Login stats
    login_count = (await db.execute(
        select(func.count(LoginHistory.id)).where(LoginHistory.user_id == u.id)
    )).scalar() or 0
    last_login_row = (await db.execute(
        select(LoginHistory.created_at).where(LoginHistory.user_id == u.id).order_by(LoginHistory.created_at.desc()).limit(1)
    )).scalar_one_or_none()

    # Emergency contact
    emerg = (await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == u.id).limit(1)
    )).scalar_one_or_none()

    # BMI calc
    height_m = (p.height / 100) if p and p.height else 1.7
    weight_kg = p.weight if p and p.weight else 70
    bmi = round(weight_kg / (height_m ** 2), 1) if height_m > 0 else 0

    return {
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "is_verified": u.is_verified,
        "is_deleted": u.is_deleted,
        "is_phone_verified": u.is_phone_verified,
        "created_at": str(u.created_at),
        "login_count": login_count,
        "last_login": str(last_login_row) if last_login_row else None,
        "profile": {
            "name": p.name if p else "User",
            "phone": p.phone if p else None,
            "age": p.age if p else None,
            "gender": p.gender if p else None,
            "height": p.height if p else None,
            "weight": p.weight if p else None,
            "bmi": bmi,
            "blood_type": p.blood_type if p else None,
            "avatar_url": p.avatar_url if p else None,
            "allergies": p.allergies if p else [],
            "conditions": p.conditions if p else [],
        },
        "emergency_contact": {
            "name": emerg.name if emerg else None,
            "phone": emerg.phone if emerg else None,
            "relation": emerg.relation if emerg else None,
        } if emerg else None,
    }


class ProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    age: int | None = None
    gender: str | None = None
    height: float | None = None
    weight: float | None = None
    blood_type: str | None = None

@router.put("/users/{user_id}/profile")
async def update_user_profile(user_id: str, data: ProfileUpdate, db: AsyncSession = Depends(get_db)):
    """Admin edits a user's profile."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(profile, field, value)
    
    await db.commit()
    return {"success": True, "message": "Profile updated"}


@router.put("/users/{user_id}/suspend")
async def suspend_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    return {"success": True, "status": "suspended"}

@router.put("/users/{user_id}/ban")
async def ban_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    user.is_deleted = True  # marks as banned
    await db.commit()
    return {"success": True, "status": "banned"}

@router.put("/users/{user_id}/activate")
async def activate_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    user.is_deleted = False
    await db.commit()
    return {"success": True, "status": "active"}

@router.put("/users/{user_id}/soft-delete")
async def soft_delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    user.is_deleted = True
    await db.commit()
    return {"success": True, "status": "soft_deleted"}

@router.put("/users/{user_id}/restore")
async def restore_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    user.is_deleted = False
    await db.commit()
    return {"success": True, "status": "restored"}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, db: AsyncSession = Depends(get_db)):
    """Admin resets a user's password to a random string."""
    import secrets, string
    from app.utils.email import send_admin_reset_password_email
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_pw = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    user.hashed_password = hash_password(new_pw)
    await db.commit()
    
    # Send email in background (or synchronously, but this is simple)
    import asyncio
    asyncio.create_task(asyncio.to_thread(send_admin_reset_password_email, user.email, new_pw))
    
    return {"success": True, "message": "Password reset and email sent"}


@router.put("/users/{user_id}/verify-email")
async def verify_user_email(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    await db.commit()
    return {"success": True, "is_verified": True}

@router.put("/users/{user_id}/verify-phone")
async def verify_user_phone(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_phone_verified = not user.is_phone_verified
    await db.commit()
    return {"success": True, "is_phone_verified": user.is_phone_verified}

class RoleUpdate(BaseModel):
    role: str

@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, data: RoleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = data.role
    await db.commit()
    return {"success": True, "role": user.role}


@router.post("/users/{user_id}/login-as")
async def login_as_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Generate a JWT for the target user so admin can impersonate them."""
    from app.utils.security import create_access_token, create_refresh_token
    from app.config import get_settings
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings = get_settings()
    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)
    return {
        "success": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.get("/users/{user_id}/export")
async def export_user_data(user_id: str, db: AsyncSession = Depends(get_db)):
    """Export all user data as JSON."""
    from app.models.medical_record import MedicalRecord
    
    # User + Profile
    result = await db.execute(
        select(User, UserProfile).outerjoin(UserProfile, User.id == UserProfile.user_id).where(User.id == user_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    u, p = row

    # Appointments
    appts = (await db.execute(select(Appointment).where(Appointment.user_id == user_id))).scalars().all()
    # Medicines
    meds = (await db.execute(select(Medicine).where(Medicine.user_id == user_id))).scalars().all()
    # Records
    records = (await db.execute(select(MedicalRecord).where(MedicalRecord.user_id == user_id))).scalars().all()
    # Emergency contacts
    contacts = (await db.execute(select(EmergencyContact).where(EmergencyContact.user_id == user_id))).scalars().all()
    # Chat messages
    messages = (await db.execute(select(ChatMessage).where(ChatMessage.user_id == user_id))).scalars().all()
    # Mood
    moods = (await db.execute(select(MoodEntry).where(MoodEntry.user_id == user_id))).scalars().all()

    def serialize(obj):
        d = {}
        for col in obj.__table__.columns:
            val = getattr(obj, col.key)
            d[col.key] = str(val) if val is not None else None
        return d

    return {
        "user": {"id": u.id, "email": u.email, "role": u.role, "created_at": str(u.created_at)},
        "profile": serialize(p) if p else None,
        "appointments": [serialize(a) for a in appts],
        "medicines": [serialize(m) for m in meds],
        "medical_records": [serialize(r) for r in records],
        "emergency_contacts": [serialize(c) for c in contacts],
        "chat_messages": [serialize(m) for m in messages],
        "mood_entries": [serialize(m) for m in moods]
    }


@router.get("/users/{user_id}/medical-history")
async def get_user_medical_history(user_id: str, db: AsyncSession = Depends(get_db)):
    """Download a user's medical records."""
    from app.models.medical_record import MedicalRecord
    
    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    records = (await db.execute(
        select(MedicalRecord).where(MedicalRecord.user_id == user_id).order_by(MedicalRecord.created_at.desc())
    )).scalars().all()
    
    meds = (await db.execute(
        select(Medicine).where(Medicine.user_id == user_id)
    )).scalars().all()
    
    appts = (await db.execute(
        select(Appointment).where(Appointment.user_id == user_id)
    )).scalars().all()

    def serialize(obj):
        d = {}
        for col in obj.__table__.columns:
            val = getattr(obj, col.key)
            d[col.key] = str(val) if val is not None else None
        return d

    return {
        "medical_records": [serialize(r) for r in records],
        "medications": [serialize(m) for m in meds],
        "appointments": [serialize(a) for a in appts],
    }

@router.get("/health-services")
async def get_health_services(db: AsyncSession = Depends(get_db)):
    """Fetch health services data for Admin Dashboard."""
    from app.models.user import User
    today_date = datetime.now(timezone.utc).date()
    # 1. Fetch all appointments (both upcoming and past)
    appts_res = await db.execute(
        select(Appointment, UserProfile.name, User.email)
        .outerjoin(UserProfile, Appointment.user_id == UserProfile.user_id)
        .outerjoin(User, Appointment.user_id == User.id)
        .order_by(Appointment.date.desc(), Appointment.time.desc())
        .limit(200)
    )
    
    appointments = []
    for appt, user_name, user_email in appts_res.all():
        appointments.append({
            "id": appt.id,
            "date": str(appt.date) if appt.date else None,
            "time": str(appt.time) if appt.time else None,
            "doctor": getattr(appt, 'doctor', None),
            "reason": getattr(appt, 'reason', None),
            "status": getattr(appt, 'status', None),
            "hospital": getattr(appt, 'hospital', None),
            "user_name": user_name or "Unknown User",
            "user_email": user_email or "No Email",
            "user_id": appt.user_id
        })
        
    # 2. Fetch SOS logs (emergencies)
    sos_res = await db.execute(
        select(SOSLog, UserProfile.name, User.email, UserProfile.phone)
        .outerjoin(UserProfile, SOSLog.user_id == UserProfile.user_id)
        .outerjoin(User, SOSLog.user_id == User.id)
        .order_by(SOSLog.created_at.desc())
        .limit(30)
    )
    
    emergencies = []
    for sos, user_name, user_email, user_phone in sos_res.all():
        emergencies.append({
            "id": sos.id,
            "is_silent": sos.is_silent,
            "created_at": str(sos.created_at),
            "user_name": user_name or "Unknown User",
            "user_email": user_email or "No Email",
            "user_phone": user_phone or "No Phone",
            "user_id": sos.user_id
        })
    # 3. Fetch Registered Organ Donors
    donors_res = await db.execute(
        select(UserProfile, User.email)
        .join(User, UserProfile.user_id == User.id)
        .where(UserProfile.organ_donor == True)
    )
    
    organ_donors = []
    for profile, email in donors_res.all():
        prefs = getattr(profile, "organ_preferences", {}) or {}
        pledged = [k for k, v in prefs.items() if v]
        organ_donors.append({
            "id": profile.id,
            "user_id": profile.user_id,
            "name": profile.name,
            "email": email,
            "age": profile.age,
            "blood_type": profile.blood_type,
            "preferences": pledged,
            "registered_date": str(profile.updated_at or profile.created_at or "")
        })
        
    return {
        "appointments": appointments,
        "emergencies": emergencies,
        "organ_donors": organ_donors
    }

from pydantic import BaseModel
from datetime import date, time as dt_time

class RescheduleRequest(BaseModel):
    date: date
    time: dt_time

@router.put("/appointments/{appt_id}/reschedule")
async def reschedule_appointment(appt_id: str, req: RescheduleRequest, db: AsyncSession = Depends(get_db)):
    """Reschedule an appointment by admin."""
    res = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = res.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appt.date = req.date
    appt.time = req.time
    await db.flush()
    await db.commit()
    return {"message": "Appointment rescheduled successfully"}

@router.put("/emergencies/{sos_id}/resolve")
async def resolve_emergency(sos_id: str, db: AsyncSession = Depends(get_db)):
    """Resolve an emergency by admin (Deletes it from the active view)."""
    res = await db.execute(select(SOSLog).where(SOSLog.id == sos_id))
    sos = res.scalar_one_or_none()
    if not sos:
        raise HTTPException(status_code=404, detail="Emergency not found")
    
    await db.delete(sos)
    await db.commit()
    return {"message": "Emergency resolved successfully"}


# ═══════════════════════════════════════════════════════════════════════
#  AUDIT LOG HELPER
# ═══════════════════════════════════════════════════════════════════════

async def log_admin_action(
    db: AsyncSession,
    admin_id: str,
    action: str,
    target_entity_type: str = None,
    target_entity_id: str = None,
    ip_address: str = None,
    device: str = None,
    details: dict = None,
    previous_value: dict = None,
    new_value: dict = None,
):
    """Insert an entry into AdminAuditLog."""
    from app.models.admin import AdminAuditLog
    log_entry = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_entity_type=target_entity_type,
        target_entity_id=target_entity_id,
        ip_address=ip_address,
        device=device,
        details=details or {},
        previous_value=previous_value,
        new_value=new_value,
    )
    db.add(log_entry)
    await db.flush()


# ═══════════════════════════════════════════════════════════════════════
#  SECURITY MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

# ── 1. Login History ──────────────────────────────────────────────────

@router.get("/security/logins")
async def get_login_history(db: AsyncSession = Depends(get_db)):
    """Fetch recent login history with user emails."""
    from app.models.user import LoginHistory, User, UserProfile
    res = await db.execute(
        select(
            LoginHistory.id,
            LoginHistory.user_id,
            LoginHistory.ip_address,
            LoginHistory.user_agent,
            LoginHistory.status,
            LoginHistory.created_at,
            User.email,
            UserProfile.name,
        )
        .outerjoin(User, LoginHistory.user_id == User.id)
        .outerjoin(UserProfile, LoginHistory.user_id == UserProfile.user_id)
        .order_by(LoginHistory.created_at.desc())
        .limit(200)
    )
    rows = res.all()
    data = []
    for r in rows:
        data.append({
            "id": r.id,
            "user_id": r.user_id,
            "ip_address": r.ip_address or "Unknown",
            "user_agent": r.user_agent or "Unknown",
            "status": r.status or "Success",
            "created_at": str(r.created_at),
            "email": r.email or "Unknown",
            "name": r.name or "Unknown User",
        })
    return {"data": data}


# ── 2. Blocked IPs ───────────────────────────────────────────────────

class BlockIPRequest(BaseModel):
    ip_address: str
    reason: str = ""

@router.get("/security/blocked-ips")
async def get_blocked_ips(db: AsyncSession = Depends(get_db)):
    """Fetch all blocked IPs."""
    from app.models.user import BlockedIP
    res = await db.execute(
        select(BlockedIP).order_by(BlockedIP.created_at.desc())
    )
    ips = res.scalars().all()
    data = []
    for ip in ips:
        data.append({
            "id": ip.id,
            "ip_address": ip.ip_address,
            "reason": ip.reason or "",
            "blocked_by": ip.blocked_by,
            "expires_at": str(ip.expires_at) if ip.expires_at else None,
            "created_at": str(ip.created_at),
        })
    return {"data": data}

@router.post("/security/blocked-ips")
async def block_ip(req: BlockIPRequest, db: AsyncSession = Depends(get_db)):
    """Block a new IP address."""
    from app.models.user import BlockedIP
    # Check if already blocked
    existing = await db.execute(
        select(BlockedIP).where(BlockedIP.ip_address == req.ip_address)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="IP is already blocked")
    
    new_block = BlockedIP(
        ip_address=req.ip_address,
        reason=req.reason,
    )
    db.add(new_block)
    await db.commit()

    # Log the action
    await log_admin_action(
        db, admin_id=None, action="Block IP",
        target_entity_type="ip", target_entity_id=req.ip_address,
        details={"reason": req.reason},
        new_value={"ip_address": req.ip_address, "reason": req.reason},
    )
    await db.commit()

    return {"message": f"IP {req.ip_address} blocked successfully"}

@router.delete("/security/blocked-ips/{block_id}")
async def unblock_ip(block_id: str, db: AsyncSession = Depends(get_db)):
    """Unblock an IP address."""
    from app.models.user import BlockedIP
    res = await db.execute(select(BlockedIP).where(BlockedIP.id == block_id))
    block = res.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Blocked IP not found")

    ip_addr = block.ip_address
    await db.delete(block)
    await db.commit()

    await log_admin_action(
        db, admin_id=None, action="Unblock IP",
        target_entity_type="ip", target_entity_id=ip_addr,
        previous_value={"ip_address": ip_addr},
    )
    await db.commit()

    return {"message": f"IP {ip_addr} unblocked successfully"}


# ── 3. Force Logout ──────────────────────────────────────────────────

@router.post("/security/force-logout/{user_id}")
async def force_logout_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Force logout a user by incrementing their token_version (invalidates all tokens)."""
    res = await db.execute(select(User).where((User.id == user_id) | (User.email == user_id)))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.token_version = (user.token_version or 1) + 1
    await db.commit()

    await log_admin_action(
        db, admin_id=None, action="Force Logout",
        target_entity_type="user", target_entity_id=user_id,
        details={"email": user.email},
    )
    await db.commit()

    return {"message": f"User {user.email} has been force logged out"}


# ── 4. Password Policy ───────────────────────────────────────────────

import json as _json

class PasswordPolicyUpdate(BaseModel):
    min_length: int = 8
    require_uppercase: bool = True
    require_numbers: bool = True
    require_symbols: bool = True

@router.get("/security/policy")
async def get_password_policy(db: AsyncSession = Depends(get_db)):
    """Fetch current password policy from SystemSetting."""
    from app.models.admin import SystemSetting
    res = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "password_policy")
    )
    setting = res.scalar_one_or_none()
    if setting and setting.value:
        data = _json.loads(setting.value)
    else:
        data = {
            "min_length": 8,
            "require_uppercase": True,
            "require_numbers": True,
            "require_symbols": True,
        }
    return {"data": data}

@router.put("/security/policy")
async def update_password_policy(req: PasswordPolicyUpdate, db: AsyncSession = Depends(get_db)):
    """Update the password policy in SystemSetting."""
    from app.models.admin import SystemSetting
    new_val = req.model_dump()

    res = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "password_policy")
    )
    setting = res.scalar_one_or_none()

    prev_val = None
    if setting:
        prev_val = _json.loads(setting.value) if setting.value else None
        setting.value = _json.dumps(new_val)
    else:
        setting = SystemSetting(
            key="password_policy",
            value=_json.dumps(new_val),
            category="security",
            description="Password policy configuration",
        )
        db.add(setting)
    
    await db.commit()

    await log_admin_action(
        db, admin_id=None, action="Update Password Policy",
        target_entity_type="setting", target_entity_id="password_policy",
        previous_value=prev_val,
        new_value=new_val,
    )
    await db.commit()

    return {"message": "Password policy updated successfully"}


# ═══════════════════════════════════════════════════════════════════════
#  AUDIT LOGS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/audit/logs")
async def get_audit_logs(
    limit: int = 100,
    action: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Fetch admin audit logs with admin email."""
    from app.models.admin import AdminAuditLog
    from app.models.user import User

    query = (
        select(
            AdminAuditLog.id,
            AdminAuditLog.admin_id,
            AdminAuditLog.action,
            AdminAuditLog.target_entity_type,
            AdminAuditLog.target_entity_id,
            AdminAuditLog.ip_address,
            AdminAuditLog.device,
            AdminAuditLog.details,
            AdminAuditLog.previous_value,
            AdminAuditLog.new_value,
            AdminAuditLog.created_at,
            User.email.label("admin_email"),
        )
        .outerjoin(User, AdminAuditLog.admin_id == User.id)
        .order_by(AdminAuditLog.created_at.desc())
        .limit(limit)
    )

    if action:
        query = query.where(AdminAuditLog.action.ilike(f"%{action}%"))

    res = await db.execute(query)
    rows = res.all()

    data = []
    for r in rows:
        data.append({
            "id": r.id,
            "admin_id": r.admin_id,
            "admin_email": r.admin_email or "System",
            "action": r.action,
            "target_entity_type": r.target_entity_type or "",
            "target_entity_id": r.target_entity_id or "",
            "ip_address": r.ip_address or "",
            "device": r.device or "",
            "details": r.details or {},
            "previous_value": r.previous_value,
            "new_value": r.new_value,
            "created_at": str(r.created_at),
        })

    return {"data": data}
