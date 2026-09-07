from fastapi import APIRouter, Depends
from sqlalchemy import select, func, distinct, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.user import User, UserProfile, LoginHistory, BlockedIP
from app.models.chat import ChatMessage
from app.models.admin import AIUsageLog, AdminAuditLog
from app.models.medical_record import MedicalRecord
from app.models.emergency import EmergencyContact, SOSLog
from app.models.family import FamilyMember
from app.models.health_tracker import SleepEntry, HealthEntry
from app.models.medicine import Medicine
from app.models.disease import SymptomCheckHistory

router = APIRouter(prefix="/admin/analytics", tags=["Admin Analytics"])

@router.get("/detailed")
async def get_detailed_analytics(db: AsyncSession = Depends(get_db)):
    """Fetch detailed analytics for the new Admin Analytics Dashboard."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # ─── 1. USER & DEMOGRAPHIC ANALYTICS ───
    dau = (await db.execute(select(func.count(distinct(LoginHistory.user_id))).where(LoginHistory.created_at >= today_start))).scalar() or 0
    mau = (await db.execute(select(func.count(distinct(LoginHistory.user_id))).where(LoginHistory.created_at >= month_ago))).scalar() or 0
    
    # Demographics (Gender)
    profiles = (await db.execute(select(UserProfile))).scalars().all()
    gender_counts = {}
    age_groups = {"<18": 0, "18-35": 0, "36-50": 0, "51+": 0}
    languages = {}
    
    for p in profiles:
        gender_counts[p.gender] = gender_counts.get(p.gender, 0) + 1
        languages[p.language] = languages.get(p.language, 0) + 1
        if p.age < 18: age_groups["<18"] += 1
        elif 18 <= p.age <= 35: age_groups["18-35"] += 1
        elif 36 <= p.age <= 50: age_groups["36-50"] += 1
        else: age_groups["51+"] += 1

    total_users = max(len(profiles), 1)
    retention_rate = round((mau / total_users) * 100) if total_users > 0 else 0

    # ─── 2. AI USAGE & PERFORMANCE ───
    ai_modules_res = await db.execute(select(AIUsageLog.feature, func.count(AIUsageLog.id)).group_by(AIUsageLog.feature))
    ai_modules = [{"name": row[0], "usage": row[1]} for row in ai_modules_res.all() if row[0]]
    ai_modules = sorted(ai_modules, key=lambda x: x["usage"], reverse=True)[:4]
    
    # We can still use ChatMessage for queries count, or combine both.
    total_ai_queries_daily = (await db.execute(select(func.count(AIUsageLog.id)).where(AIUsageLog.created_at >= today_start))).scalar() or 0
    total_ai_queries_weekly = (await db.execute(select(func.count(AIUsageLog.id)).where(AIUsageLog.created_at >= week_ago))).scalar() or 0

    # AI Feedback Score (ratio of thumbs up to thumbs down)
    thumbs_up = (await db.execute(select(func.count(ChatMessage.id)).where(ChatMessage.feedback == 1))).scalar() or 0
    thumbs_down = (await db.execute(select(func.count(ChatMessage.id)).where(ChatMessage.feedback == -1))).scalar() or 0
    feedback_score = round((thumbs_up / (thumbs_up + thumbs_down)) * 100) if (thumbs_up + thumbs_down) > 0 else 100

    # Avg Response Time (Mocked for now since not precisely tracked on chat_messages, or use AIUsageLog if populated)
    avg_response_res = (await db.execute(select(func.avg(AIUsageLog.response_time_ms)))).scalar()
    avg_response_time = round(avg_response_res) if avg_response_res else 0

    # ─── 3. HEALTH OUTCOMES & ENGAGEMENT ───

    sleep_completions = (await db.execute(select(func.count(distinct(SleepEntry.user_id))).where(SleepEntry.date == today_start.date(), SleepEntry.hours >= 7))).scalar() or 0
    sleep_completion_rate = round((sleep_completions / total_users) * 100) if total_users > 0 else 0

    workout_completions = (await db.execute(select(func.count(distinct(HealthEntry.user_id))).where(HealthEntry.category == 'calories', HealthEntry.recorded_at >= today_start))).scalar() or 0
    workout_completion_rate = round((workout_completions / total_users) * 100) if total_users > 0 else 0

    medication_adherence = (await db.execute(select(func.count(Medicine.id)).where(Medicine.is_active == True))).scalar() or 0

    # Top symptoms
    symptom_histories = (await db.execute(select(SymptomCheckHistory))).scalars().all()
    symptom_counts = {}
    for sh in symptom_histories:
        for sym in sh.symptoms:
            if isinstance(sym, str):
                symptom_counts[sym.capitalize()] = symptom_counts.get(sym.capitalize(), 0) + 1
    
    top_symptoms = [{"name": name, "count": count} for name, count in sorted(symptom_counts.items(), key=lambda x: x[1], reverse=True)[:4]]

    # ─── 4. FEATURE ADOPTION ───
    medical_records_uploads = (await db.execute(select(func.count(MedicalRecord.id)))).scalar() or 0
    emergency_sos_usage = (await db.execute(select(func.count(SOSLog.id)))).scalar() or 0
    family_profiles = (await db.execute(select(func.count(FamilyMember.id)))).scalar() or 0

    # ─── 5. SYSTEM SECURITY & HEALTH ───
    failed_logins = (await db.execute(select(func.count(LoginHistory.id)).where(LoginHistory.status == 'Failed'))).scalar() or 0
    blocked_ips = (await db.execute(select(func.count(BlockedIP.id)))).scalar() or 0
    api_error_rates = 0.2 # mock 0.2%

    # ─── 6. CLOUD DATABASE STORAGE MONITORING ───
    db_storage_bytes = 0
    db_storage_mb = 0.0
    db_storage_formatted = "0 MB"
    try:
        db_size_res = await db.execute(text("SELECT pg_database_size(current_database()), pg_size_pretty(pg_database_size(current_database()))"))
        db_row = db_size_res.fetchone()
        if db_row:
            db_storage_bytes = int(db_row[0] or 0)
            db_storage_formatted = str(db_row[1] or "0 MB")
            db_storage_mb = round(db_storage_bytes / (1024 * 1024), 2)
    except Exception:
        pass

    return {
        "demographics": {
            "dau": dau,
            "mau": mau,
            "gender": gender_counts,
            "age_groups": age_groups,
            "languages": languages,
            "retention_rate": retention_rate
        },
        "ai_performance": {
            "modules": ai_modules,
            "daily_queries": total_ai_queries_daily,
            "weekly_queries": total_ai_queries_weekly,
            "feedback_score": feedback_score,
            "avg_response_time": avg_response_time,
            "thumbs_up": thumbs_up,
            "thumbs_down": thumbs_down
        },
        "health_outcomes": {
            "sleep_completion": sleep_completion_rate,
            "workout_completion": workout_completion_rate,
            "medication_adherence_count": medication_adherence,
            "top_symptoms": top_symptoms
        },
        "feature_adoption": {
            "medical_records": medical_records_uploads,
            "emergency_sos": emergency_sos_usage,
            "family_profiles": family_profiles
        },
        "security": {
            "failed_logins": failed_logins,
            "blocked_ips": blocked_ips,
            "api_errors": api_error_rates
        },
        "database_storage": {
            "size_mb": db_storage_mb,
            "size_bytes": db_storage_bytes,
            "formatted": db_storage_formatted,
            "provider": "Supabase Cloud PostgreSQL"
        }
    }


@router.get("/database-storage")
async def get_database_storage_stats(db: AsyncSession = Depends(get_db)):
    """Fetch real-time database storage and top tables breakdown from Supabase Cloud."""
    db_storage_bytes = 0
    db_storage_formatted = "0 MB"
    db_storage_mb = 0.0
    tables = []

    try:
        size_res = await db.execute(text("SELECT pg_database_size(current_database()), pg_size_pretty(pg_database_size(current_database()))"))
        row = size_res.fetchone()
        if row:
            db_storage_bytes = int(row[0] or 0)
            db_storage_formatted = str(row[1] or "0 MB")
            db_storage_mb = round(db_storage_bytes / (1024 * 1024), 2)

        table_query = text("""
            SELECT 
                relname AS table_name,
                pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
                pg_total_relation_size(relid) AS total_bytes
            FROM pg_catalog.pg_statio_user_tables
            ORDER BY pg_total_relation_size(relid) DESC
            LIMIT 15;
        """)
        t_res = await db.execute(table_query)
        for t_row in t_res.fetchall():
            tables.append({
                "table_name": t_row[0],
                "size_formatted": t_row[1],
                "size_bytes": int(t_row[2] or 0),
                "size_mb": round(int(t_row[2] or 0) / (1024 * 1024), 3)
            })
    except Exception as e:
        return {"status": "error", "message": str(e), "size_mb": 0}

    return {
        "status": "success",
        "database_size_mb": db_storage_mb,
        "database_size_formatted": db_storage_formatted,
        "database_size_bytes": db_storage_bytes,
        "provider": "Supabase Cloud PostgreSQL",
        "tables": tables
    }

