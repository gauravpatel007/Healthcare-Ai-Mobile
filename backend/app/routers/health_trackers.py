"""
LifeOS Backend — Health Trackers Router
Water intake, sleep tracking, health metrics, BMI/BMR.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.health_tracker import HealthEntry, SleepEntry
from app.models.user import UserProfile
from app.schemas.health_tracker import (
    BMIResponse, HealthEntryCreate, HealthEntryResponse,
    SleepEntryCreate, SleepEntryResponse,
    WearableConnectRequest, WearableSyncResponse, FitbitCallbackRequest, VoiceLogRequest
)
from app.utils.helpers import calculate_bmi, calculate_bmr, calculate_tdee, get_bmi_category
from app.utils.nlp import parse_voice_command

router = APIRouter(prefix="/trackers", tags=["Health Trackers"])

@router.post("/voice-log")
async def process_voice_log(data: VoiceLogRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Process a voice command to log a health metric or trigger a UI action."""
    result = await parse_voice_command(data.text)
    
    actions = result.get("actions", [])
    if not actions:
        # Fallback if the LLM returned a single action
        if "type" in result:
            actions = [result]
        else:
            return {"success": False, "message": f"Could not understand the command: '{data.text}'"}
            
    responses = []
    has_ui_action = None
    
    from datetime import datetime, date, timezone
    d = date.today()
    
    for intent in actions:
        intent_type = intent.get("type")
        if not intent_type or intent_type == "unknown":
            if "error" in intent:
                return {"success": False, "message": f"AI Parsing Error: {intent['error']}"}
            continue
            
        if intent_type == "action":
            # Store the first UI action to execute later
            if not has_ui_action:
                has_ui_action = intent
            continue
            
        val = float(intent.get("value", 0)) if "value" in intent else 0
        
        if intent_type == "sleep" and val > 0:
            res = await db.execute(select(SleepEntry).where(SleepEntry.user_id == user_id, SleepEntry.date == d))
            existing_sleep = res.scalars().first()
            if existing_sleep:
                existing_sleep.hours = val
                existing_sleep.quality = 3
            else:
                entry = SleepEntry(user_id=user_id, date=d, hours=val, quality=3)
                db.add(entry)
            responses.append(f"Logged {val} hours of sleep.")
            
        elif intent_type == "weight" and val > 0:
            start_of_day = datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(d, datetime.max.time()).replace(tzinfo=timezone.utc)
            res = await db.execute(select(HealthEntry).where(
                HealthEntry.user_id == user_id, HealthEntry.category == "weight",
                HealthEntry.recorded_at >= start_of_day, HealthEntry.recorded_at <= end_of_day
            ))
            existing_weight = res.scalars().first()
            if existing_weight:
                existing_weight.value = val
                existing_weight.recorded_at = datetime.now(timezone.utc)
            else:
                entry = HealthEntry(user_id=user_id, category="weight", value=val, recorded_at=datetime.now(timezone.utc))
                db.add(entry)
            responses.append(f"Logged weight as {val} kg.")
            
        elif intent_type == "blood_pressure" and val > 0:
            sec_val = float(intent.get("secondary_value", val))
            start_of_day = datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(d, datetime.max.time()).replace(tzinfo=timezone.utc)
            res = await db.execute(select(HealthEntry).where(
                HealthEntry.user_id == user_id, HealthEntry.category == "blood_pressure",
                HealthEntry.recorded_at >= start_of_day, HealthEntry.recorded_at <= end_of_day
            ))
            existing_bp = res.scalars().first()
            if existing_bp:
                existing_bp.value = val
                existing_bp.secondary_value = sec_val
                existing_bp.recorded_at = datetime.now(timezone.utc)
            else:
                entry = HealthEntry(user_id=user_id, category="blood_pressure", value=val, secondary_value=sec_val, recorded_at=datetime.now(timezone.utc))
                db.add(entry)
            responses.append(f"Logged blood pressure as {val} over {sec_val}.")

        elif intent_type == "heart_rate" and val > 0:
            start_of_day = datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(d, datetime.max.time()).replace(tzinfo=timezone.utc)
            res = await db.execute(select(HealthEntry).where(
                HealthEntry.user_id == user_id, HealthEntry.category == "heart_rate",
                HealthEntry.recorded_at >= start_of_day, HealthEntry.recorded_at <= end_of_day
            ))
            existing_hr = res.scalars().first()
            if existing_hr:
                existing_hr.value = val
                existing_hr.recorded_at = datetime.now(timezone.utc)
            else:
                entry = HealthEntry(user_id=user_id, category="heart_rate", value=val, recorded_at=datetime.now(timezone.utc))
                db.add(entry)
            responses.append(f"Logged heart rate as {val} bpm.")
        elif intent_type == "medicine_log":
            from app.models.medicine import Medicine, MedicineLog
            med_name = intent.get("name", "").strip()
            if med_name:
                # Find matching active medicine for user
                res = await db.execute(select(Medicine).where(
                    Medicine.user_id == user_id, Medicine.is_active == True,
                    Medicine.name.ilike(f"%{med_name}%")
                ))
                med = res.scalars().first()
                if med:
                    hour = datetime.now().hour
                    if hour < 12: current_slot = 'Morning'
                    elif hour < 18: current_slot = 'Afternoon'
                    else: current_slot = 'Evening'
                    
                    slots = []
                    if med.frequency == 'once_daily': slots = ['Morning']
                    elif med.frequency == 'twice_daily': slots = ['Morning', 'Evening']
                    elif med.frequency == 'thrice_daily': slots = ['Morning', 'Afternoon', 'Evening']
                    else: slots = ['Anytime']
                    
                    target_slot = current_slot if current_slot in slots else slots[0]

                    log_entry = MedicineLog(
                        user_id=user_id, medicine_id=med.id, date=d, 
                        scheduled_time=target_slot, status="taken"
                    )
                    db.add(log_entry)
                    responses.append(f"Logged that you took {med.name}.")
                else:
                    responses.append(f"Could not find an active medicine matching '{med_name}'.")

        elif intent_type == "nutrition_log":
            food_name = intent.get("food", "").strip()
            if food_name:
                # Rough calorie estimation via NLP or simple heuristic
                # (In a full prod system, we'd query an external API or DB here)
                # We'll use the LLM to get a quick estimate
                from app.utils.nlp import client
                try:
                    cal_res = await client.chat.completions.create(
                        model="openai/gpt-oss-120b",
                        messages=[{"role": "user", "content": f"Estimate calories for: {food_name}. Reply ONLY with a single integer number."}],
                        temperature=0.0
                    )
                    calories = int(cal_res.choices[0].message.content.strip())
                except:
                    calories = 200 # fallback
                    
                entry = HealthEntry(
                    user_id=user_id, category="calories", value=calories, 
                    label=food_name, recorded_at=datetime.now(timezone.utc)
                )
                db.add(entry)
                responses.append(f"Added {food_name} ({calories} kcal) to your nutrition log.")

    await db.commit()
    
    if responses:
        summary_msg = " ".join(responses)
        if not has_ui_action:
            has_ui_action = {"target_feature": "dashboard", "action_name": "refresh_data"}
            
    if has_ui_action:
        # If there's a UI action, return it. If data was also logged, attach the summary message.
        msg = summary_msg if responses else f"Navigating to {has_ui_action.get('target_feature', 'dashboard')}..."
        
        # Special case: Jarvis AI Voice Triage / First aid
        if has_ui_action.get("target_feature") == "jarvis_ai":
            action = has_ui_action.get("action_name")
            prompt = ""
            if action == "first_aid":
                query = has_ui_action.get("data", {}).get("query", "")
                prompt = f"The user is asking for first aid: '{query}'. Provide a concise, step-by-step spoken response (max 4 sentences). Do not use markdown."
            elif action == "triage":
                symptoms = has_ui_action.get("data", {}).get("symptoms", "")
                prompt = f"The user reports symptoms: '{symptoms}'. Provide a quick, empathetic spoken triage response advising care. Keep it under 3 sentences."
            if prompt:
                from app.utils.nlp import client
                try:
                    response = await client.chat.completions.create(
                        model="openai/gpt-oss-120b",
                        messages=[
                            {"role": "system", "content": "You are Jarvis, a concise health assistant voice."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.3
                    )
                    spoken_text = response.choices[0].message.content.strip()
                    return {
                        "success": True, "type": "action", "target_feature": "voice",
                        "action_name": "speak", "data": {"text": spoken_text}, "message": "Speaking..."
                    }
                except:
                    pass

        return {
            "success": True, "type": "action", "target_feature": has_ui_action.get("target_feature", "dashboard"),
            "action_name": has_ui_action.get("action_name", "open_page"), "data": has_ui_action.get("data", {}),
            "message": msg
        }
        
    friendly_msg = "I'm sorry, I didn't quite catch that. Could you please repeat?"
    return {
        "success": True, 
        "message": friendly_msg,
        "type": "action",
        "target_feature": "voice",
        "action_name": "speak",
        "data": {"text": friendly_msg}
    }





# ─── Sleep Tracking ──────────────────────────────────────────────────

@router.post("/sleep", response_model=SleepEntryResponse, status_code=201)
async def log_sleep(data: SleepEntryCreate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Log a sleep entry."""
    target_date = data.date or date.today()
    result = await db.execute(select(SleepEntry).where(SleepEntry.user_id == user_id, SleepEntry.date == target_date))
    existing = result.scalars().first()

    if existing:
        existing.hours = data.hours
        existing.quality = data.quality
        existing.bedtime = data.bedtime
        existing.wake_time = data.wake_time
        entry = existing
    else:
        entry = SleepEntry(
            user_id=user_id,
            date=target_date,
            hours=data.hours,
            quality=data.quality,
            bedtime=data.bedtime,
            wake_time=data.wake_time,
        )
        db.add(entry)

    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/sleep", response_model=list[SleepEntryResponse])
async def get_sleep(user_id: CurrentUserId, limit: int = 7, db: AsyncSession = Depends(get_db)):
    """Get recent sleep entries."""
    result = await db.execute(
        select(SleepEntry).where(SleepEntry.user_id == user_id)
        .order_by(SleepEntry.date.desc())
    )
    entries = result.scalars().all()
    
    unique_entries = {}
    for e in entries:
        if e.date not in unique_entries:
            unique_entries[e.date] = e
            
    return list(unique_entries.values())[:limit]


# ─── Health Metrics ──────────────────────────────────────────────────

@router.post("/health-entry", response_model=HealthEntryResponse, status_code=201)
async def add_health_entry(data: HealthEntryCreate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Log a health metric (blood sugar, BP, weight, etc.)."""
    target_date = data.recorded_at.date() if data.recorded_at else datetime.now(timezone.utc).date()
    start_of_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_of_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=timezone.utc)

    result = await db.execute(select(HealthEntry).where(
        HealthEntry.user_id == user_id,
        HealthEntry.category == data.category,
        HealthEntry.recorded_at >= start_of_day,
        HealthEntry.recorded_at <= end_of_day
    ))
    existing = result.scalars().first()

    if existing:
        existing.value = data.value
        existing.secondary_value = data.secondary_value
        existing.label = data.label
        existing.recorded_at = data.recorded_at or datetime.now(timezone.utc)
        entry = existing
    else:
        entry = HealthEntry(
            user_id=user_id,
            category=data.category,
            value=data.value,
            secondary_value=data.secondary_value,
            label=data.label,
            recorded_at=data.recorded_at or datetime.now(timezone.utc),
        )
        db.add(entry)
    
    # Sync with UserProfile if it's a weight update
    if data.category == "weight":
        profile_res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        profile = profile_res.scalars().first()
        if profile and profile.weight != data.value:
            profile.weight = data.value
            db.add(profile)

    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/health-data", response_model=dict)
async def get_health_data(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get all health data organized by category."""
    result = await db.execute(
        select(HealthEntry).where(HealthEntry.user_id == user_id).order_by(HealthEntry.recorded_at.desc())
    )
    entries = result.scalars().all()

    data = {}
    unique_keys = set()
    
    for e in entries:
        cat = e.category
        d_str = str(e.recorded_at.date()) if e.recorded_at else "unknown"
        key = f"{cat}_{d_str}"
        
        if key in unique_keys and cat not in ["steps", "calories"]:
            continue
        unique_keys.add(key)

        if cat not in data:
            data[cat] = []
        entry_data = {
            "value": e.value,
            "label": e.label or "",
            "recorded_at": str(e.recorded_at),
        }
        if e.secondary_value is not None:
            if cat == "blood_pressure":
                entry_data["systolic"] = e.value
                entry_data["diastolic"] = e.secondary_value
            else:
                entry_data["secondary_value"] = e.secondary_value
        data[cat].append(entry_data)

    for cat in data:
        data[cat].reverse()

    # Add sleep data from SleepEntry
    sleep_result = await db.execute(
        select(SleepEntry).where(SleepEntry.user_id == user_id).order_by(SleepEntry.date.desc())
    )
    sleep_entries = sleep_result.scalars().all()
    if sleep_entries:
        unique_sleep = {}
        for s in sleep_entries:
            if s.date not in unique_sleep:
                unique_sleep[s.date] = s
                
        sleep_list = list(unique_sleep.values())
        sleep_list.reverse()
        
        data["sleep"] = [
            {
                "value": s.hours,
                "label": "Sleep",
                "recorded_at": str(s.date)
            } for s in sleep_list
        ]

    return data


# ─── BMI/BMR Calculator ─────────────────────────────────────────────

@router.get("/bmi", response_model=BMIResponse)
async def get_bmi(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Calculate BMI, BMR, and TDEE from user profile."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalars().first()

    weight = profile.weight if profile else 70
    height = profile.height if profile else 170
    age = profile.age if profile else 30
    gender = profile.gender if profile else "Male"

    bmi = calculate_bmi(weight, height)
    bmr = calculate_bmr(weight, height, age, gender)

    return BMIResponse(
        bmi=bmi,
        category=get_bmi_category(bmi),
        bmr=bmr,
        tdee_by_activity={
            "sedentary": calculate_tdee(bmr, "sedentary"),
            "light": calculate_tdee(bmr, "light"),
            "moderate": calculate_tdee(bmr, "moderate"),
            "very_active": calculate_tdee(bmr, "very_active"),
            "extra_active": calculate_tdee(bmr, "extra_active"),
        },
        weight=weight,
        height=height,
    )


# ─── Wearable Integration ─────────────────────────────────────────────

@router.get("/wearable/status")
async def get_wearable_status(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get list of connected wearable devices."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalars().first()
    return {"connected_devices": profile.connected_devices if profile and profile.connected_devices else []}


@router.post("/wearable/connect")
async def connect_wearable(data: WearableConnectRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Connect or disconnect a wearable device."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalars().first()
    if not profile:
        return {"success": False, "message": "Profile not found."}
    
    current_devices = profile.connected_devices or []
    # If device not connected, connect it (simulated)
    if data.device_name not in current_devices:
        new_devices = current_devices + [data.device_name]
        profile.connected_devices = new_devices
        await db.commit()
        return {"success": True, "connected": True, "devices": new_devices}
    return {"success": True, "connected": True, "devices": current_devices}


@router.post("/fitbit/callback")
async def fitbit_callback(data: FitbitCallbackRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Exchange Fitbit auth code for tokens."""
    import urllib.request
    import urllib.parse
    import json
    import base64
    from app.config import get_settings
    settings = get_settings()
    
    if not settings.FITBIT_CLIENT_ID or not settings.FITBIT_CLIENT_SECRET:
        return {"success": False, "message": "Fitbit credentials not configured on server."}

    url = "https://oauth2.googleapis.com/token"
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    # We must match the exact redirect_uri configured in the Google Cloud Console
    redirect_uri = "http://localhost:5173/app/trackers"
    
    data_payload = urllib.parse.urlencode({
        "client_id": settings.FITBIT_CLIENT_ID,
        "client_secret": settings.FITBIT_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code": data.code
    }).encode()
    
    req = urllib.request.Request(url, data=data_payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read())
            
            # Save tokens to profile
            result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
            profile = result.scalars().first()
            if profile:
                profile.fitbit_access_token = res_data.get("access_token")
                profile.fitbit_refresh_token = res_data.get("refresh_token")
                
                # Automatically add Fitbit to connected_devices
                current = profile.connected_devices or []
                if "Fitbit" not in current:
                    profile.connected_devices = current + ["Fitbit"]
                
                await db.commit()
                return {"success": True, "message": "Fitbit successfully connected!"}
    except Exception as e:
        import logging
        logging.getLogger("lifeos").error(f"Fitbit token exchange failed: {e}")
        return {"success": False, "message": "Failed to exchange Fitbit code for tokens."}

    return {"success": False, "message": "Unknown error."}


@router.get("/wearable/sync", response_model=WearableSyncResponse)
async def sync_wearable(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Simulate or fetch REAL data from wearables and save to DB."""
    import random
    import urllib.request
    import json
    
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalars().first()
    
    weight = profile.weight if profile else 70
    height = profile.height if profile else 170
    age = profile.age if profile else 30
    gender = profile.gender if profile else "Male"
    bmr = calculate_bmr(weight, height, age, gender)
    base_tdee = calculate_tdee(bmr, "moderate")
    
    simulated_hr = round(random.uniform(62, 85))
    simulated_sleep = round(random.uniform(6.5, 8.5), 1)
    simulated_steps = int(random.uniform(3000, 12000))
    simulated_cals = int((simulated_steps / 10000) * (base_tdee * 0.2)) + int(base_tdee * 0.1)

    # Attempt REAL Fitbit sync if token exists
    if profile and profile.fitbit_access_token:
        try:
            import time
            end_time = int(time.time() * 1000)
            start_time = end_time - (24 * 60 * 60 * 1000)
            
            payload = {
                "aggregateBy": [
                    {"dataTypeName": "com.google.step_count.delta"},
                    {"dataTypeName": "com.google.calories.expended"}
                ],
                "bucketByTime": {"durationMillis": 86400000},
                "startTimeMillis": start_time,
                "endTimeMillis": end_time
            }
            
            req = urllib.request.Request(
                "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
                data=json.dumps(payload).encode(),
                headers={
                    "Authorization": f"Bearer {profile.fitbit_access_token}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req) as response:
                fitness_data = json.loads(response.read())
                with open("fitness_debug.txt", "w") as f:
                    f.write(f"SUCCESS DATA:\n{json.dumps(fitness_data)}")
                
                # Parse the Google Fitness response
                if "bucket" in fitness_data and len(fitness_data["bucket"]) > 0:
                    for dataset in fitness_data["bucket"][0].get("dataset", []):
                        ds_id = dataset.get("dataSourceId", "")
                        pts = dataset.get("point", [])
                        if pts and len(pts[0].get("value", [])) > 0:
                            if "step_count" in ds_id:
                                simulated_steps = pts[0]["value"][0].get("intVal", simulated_steps)
                            elif "calories.expended" in ds_id:
                                simulated_cals = int(pts[0]["value"][0].get("fpVal", simulated_cals))
                    
        except Exception as e:
            with open("fitness_debug.txt", "w") as f:
                f.write(f"EXCEPTION: {str(e)}\n")
                if hasattr(e, 'read'):
                    f.write(f"BODY: {e.read().decode()}\n")
            import logging
            logging.getLogger("lifeos").error(f"Google Fitness API fetch failed: {e}")
            pass

    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")

    steps_entry = HealthEntry(user_id=user_id, category="steps", value=simulated_steps, label=date_str, recorded_at=now)
    cals_entry = HealthEntry(user_id=user_id, category="calories", value=simulated_cals, label=date_str, recorded_at=now)
    hr_entry = HealthEntry(user_id=user_id, category="heart_rate", value=simulated_hr, label=date_str, recorded_at=now)
    
    db.add_all([steps_entry, cals_entry, hr_entry])
    await db.commit()

    return WearableSyncResponse(
        heart_rate=simulated_hr,
        sleep_hours=simulated_sleep,
        steps=simulated_steps,
        calories_burned=simulated_cals
    )
