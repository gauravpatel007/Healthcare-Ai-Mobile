"""
LifeOS Backend — AI Fitness Coach Router
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.health_tracker import HealthEntry
from app.models.user import UserProfile
from app.schemas.chat import FitnessStatsResponse
from app.services.ai_service import generate_ai_response

router = APIRouter(prefix="/ai/fitness", tags=["AI Fitness"])

# Workout database (matching frontend)
WORKOUTS = {
    "cardio": [
        {"name": "Brisk Walking", "duration": "30 min", "calories": 150, "icon": "🚶", "sets": "-", "reps": "-", "difficulty": "Easy"},
        {"name": "Jogging", "duration": "20 min", "calories": 200, "icon": "🏃", "sets": "-", "reps": "-", "difficulty": "Medium"},
        {"name": "Jumping Jacks", "duration": "15 min", "calories": 130, "icon": "⭐", "sets": "3", "reps": "30", "difficulty": "Easy"},
        {"name": "Cycling", "duration": "30 min", "calories": 250, "icon": "🚴", "sets": "-", "reps": "-", "difficulty": "Medium"},
        {"name": "Swimming", "duration": "30 min", "calories": 300, "icon": "🏊", "sets": "-", "reps": "-", "difficulty": "Medium"},
    ],
    "strength": [
        {"name": "Push-ups", "duration": "10 min", "calories": 70, "icon": "💪", "sets": "3", "reps": "15", "difficulty": "Medium"},
        {"name": "Squats", "duration": "10 min", "calories": 80, "icon": "🦵", "sets": "3", "reps": "20", "difficulty": "Medium"},
        {"name": "Planks", "duration": "5 min", "calories": 30, "icon": "🧘", "sets": "3", "reps": "60 sec", "difficulty": "Medium"},
        {"name": "Lunges", "duration": "10 min", "calories": 75, "icon": "🏋️", "sets": "3", "reps": "12 each", "difficulty": "Medium"},
        {"name": "Dumbbell Rows", "duration": "10 min", "calories": 65, "icon": "🏋️", "sets": "3", "reps": "12", "difficulty": "Hard"},
    ],
    "yoga": [
        {"name": "Sun Salutation", "duration": "15 min", "calories": 60, "icon": "🧘", "sets": "5", "reps": "cycles", "difficulty": "Easy"},
        {"name": "Warrior Pose", "duration": "10 min", "calories": 40, "icon": "🧘", "sets": "-", "reps": "Hold 30s", "difficulty": "Easy"},
        {"name": "Tree Pose", "duration": "5 min", "calories": 20, "icon": "🌳", "sets": "-", "reps": "Hold 30s", "difficulty": "Easy"},
        {"name": "Downward Dog", "duration": "5 min", "calories": 25, "icon": "🐕", "sets": "-", "reps": "Hold 60s", "difficulty": "Easy"},
    ],
    "hiit": [
        {"name": "Burpees", "duration": "10 min", "calories": 120, "icon": "🔥", "sets": "4", "reps": "10", "difficulty": "Hard"},
        {"name": "Mountain Climbers", "duration": "10 min", "calories": 100, "icon": "⛰️", "sets": "4", "reps": "20", "difficulty": "Hard"},
        {"name": "High Knees", "duration": "5 min", "calories": 60, "icon": "🦵", "sets": "3", "reps": "30", "difficulty": "Medium"},
        {"name": "Box Jumps", "duration": "10 min", "calories": 110, "icon": "📦", "sets": "4", "reps": "12", "difficulty": "Hard"},
    ],
    "gym": [
        {"name": "Bench Press", "duration": "15 min", "calories": 100, "icon": "🏋️", "sets": "4", "reps": "8-10", "difficulty": "Hard"},
        {"name": "Deadlifts", "duration": "15 min", "calories": 120, "icon": "🏋️", "sets": "4", "reps": "5-8", "difficulty": "Hard"},
        {"name": "Leg Press", "duration": "10 min", "calories": 90, "icon": "🦵", "sets": "3", "reps": "12", "difficulty": "Medium"},
        {"name": "Cable Crossovers", "duration": "10 min", "calories": 70, "icon": "💪", "sets": "3", "reps": "12-15", "difficulty": "Medium"},
        {"name": "Pull-ups", "duration": "10 min", "calories": 80, "icon": "🏋️", "sets": "3", "reps": "Max", "difficulty": "Hard"},
    ],
}

WEEKLY_PLAN = [
    {"day": "Monday", "workout": "Upper Body + Cardio", "duration": "45 min", "icon": "💪", "rest": False},
    {"day": "Tuesday", "workout": "Lower Body", "duration": "45 min", "icon": "🦵", "rest": False},
    {"day": "Wednesday", "workout": "Yoga & Flexibility", "duration": "30 min", "icon": "🧘", "rest": False},
    {"day": "Thursday", "workout": "HIIT", "duration": "25 min", "icon": "🔥", "rest": False},
    {"day": "Friday", "workout": "Full Body Strength", "duration": "50 min", "icon": "🏋️", "rest": False},
    {"day": "Saturday", "workout": "Cardio", "duration": "40 min", "icon": "🏃", "rest": False},
    {"day": "Sunday", "workout": "Rest & Light Stretch", "duration": "20 min", "icon": "🛌", "rest": True},
]


@router.get("/workout")
async def get_workouts(category: str = "cardio"):
    """Get workout exercises by category."""
    workouts = WORKOUTS.get(category, WORKOUTS["cardio"])
    return {"category": category, "exercises": workouts}


@router.get("/weekly-plan")
async def weekly_plan():
    """Get weekly workout schedule."""
    return {"plan": WEEKLY_PLAN}

@router.post("/regenerate-plan")
async def regenerate_plan(user_id: CurrentUserId):
    """Regenerate weekly workout schedule."""
    import random
    categories = list(WORKOUTS.keys())
    new_plan = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Ensure variety
    for i, day in enumerate(days):
        if i == 6:  # Sunday rest
            new_plan.append({"day": day, "workout": "Rest & Light Stretch", "duration": "20 min", "icon": "🛌", "rest": True})
            continue
            
        cat = random.choice(categories)
        if i == 0: cat = "gym" # Force gym at least once
        elif i == 1: cat = "cardio"
        elif i == 2: cat = "hiit"
        elif i == 3: cat = "yoga"
        elif i == 4: cat = "strength"
        elif i == 5: cat = "gym"
        
        exercise = random.choice(WORKOUTS[cat])
        new_plan.append({
            "day": day,
            "workout": f"{cat.title()} - {exercise['name']}",
            "duration": exercise['duration'],
            "icon": exercise['icon'],
            "rest": False
        })
        
    return {"plan": new_plan}


@router.post("/steps")
async def add_steps(
    steps: int, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Log steps for today."""
    from datetime import datetime, timezone
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    steps_r = await db.execute(
        select(HealthEntry).where(
            HealthEntry.user_id == user_id,
            HealthEntry.category == "steps",
            HealthEntry.recorded_at >= today_start,
        )
    )
    current_steps = sum(int(e.value) for e in steps_r.scalars().all())
    
    # If the user has a negative balance from past bugs, offset it first
    if current_steps < 0:
        db.add(HealthEntry(
            user_id=user_id, category="steps", value=float(-current_steps),
            label="System Offset", recorded_at=datetime.now(timezone.utc)
        ))

    entry = HealthEntry(
        user_id=user_id, category="steps", value=float(steps),
        label=date.today().strftime("%a"), recorded_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    return {"success": True, "steps": steps}


@router.get("/stats", response_model=FitnessStatsResponse)
async def fitness_stats(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get today's activity stats."""
    from datetime import datetime, timezone

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Steps
    steps_r = await db.execute(
        select(HealthEntry).where(
            HealthEntry.user_id == user_id,
            HealthEntry.category == "steps",
            HealthEntry.recorded_at >= today_start,
        )
    )
    steps = sum(int(e.value) for e in steps_r.scalars().all())
    steps = max(0, steps)

    # Calories burned
    cals_r = await db.execute(
        select(HealthEntry).where(
            HealthEntry.user_id == user_id,
            HealthEntry.category == "calories",
            HealthEntry.recorded_at >= today_start,
        )
    )
    calories = sum(int(e.value) for e in cals_r.scalars().all())
    calories = max(0, calories)

    from datetime import timedelta
    now_utc = datetime.now(timezone.utc)
    week_start = (now_utc - timedelta(days=now_utc.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    workouts_r = await db.execute(
        select(HealthEntry).where(
            HealthEntry.user_id == user_id,
            HealthEntry.category == "calories",
            HealthEntry.recorded_at >= week_start
        )
    )
    # Count unique days where workouts were logged
    workout_days = {e.recorded_at.date() for e in workouts_r.scalars().all()}
    workouts_this_week = len(workout_days)

    from sqlalchemy import text
    try:
        await db.execute(text("ALTER TABLE user_profiles ADD COLUMN step_goal INTEGER NOT NULL DEFAULT 10000;"))
        await db.commit()
    except Exception:
        await db.rollback()
        
    profile_res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_res.scalars().first()
    step_goal = profile.step_goal if profile and getattr(profile, 'step_goal', None) else 10000
    calorie_goal = profile.burn_calorie_goal if profile and getattr(profile, 'burn_calorie_goal', None) else 500
    
    return FitnessStatsResponse(
        steps=steps,
        calories_burned=calories,
        active_minutes=round(steps / 100),
        distance_km=round(steps * 0.000762, 2),
        step_goal=step_goal,
        calorie_goal=calorie_goal,
        step_percentage=round((steps / step_goal) * 100, 1),
        workouts_this_week=workouts_this_week
    )


@router.post("/log")
async def log_exercise(
    exercise_name: str, duration_minutes: int, calories: int,
    user_id: CurrentUserId, db: AsyncSession = Depends(get_db),
):
    """Log a completed exercise."""
    from datetime import datetime, timezone
    entry = HealthEntry(
        user_id=user_id, category="calories", value=float(calories),
        label=exercise_name, recorded_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    return {"success": True, "exercise": exercise_name, "duration": duration_minutes, "calories": calories}

from pydantic import BaseModel

class GoalAnalysisRequest(BaseModel):
    current_weight: float
    target_weight: float
    timeline: str

class WorkoutDetailsRequest(BaseModel):
    workout_name: str

@router.post("/generate-workout-details")
async def generate_workout_details(
    data: WorkoutDetailsRequest, user_id: CurrentUserId
):
    """Generate specific exercises for a given workout name using AI."""
    prompt = f"""Generate a detailed workout routine for '{data.workout_name}'.
Return ONLY a valid JSON array of objects. Each object must have exactly these keys:
- "name": string (the exercise name)
- "sets": string (e.g. "3", "4", "1")
- "reps": string (e.g. "10-12", "60 sec", "15 min")

Keep it to 4-5 exercises. Output ONLY the raw JSON array, no markdown formatting.
"""
    response = await generate_ai_response("fitness", prompt, max_tokens=300)
    
    try:
        import re
        import json
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
            return {"exercises": parsed}
        else:
            raise ValueError("No JSON array found")
    except Exception:
        # Fallback
        return {"exercises": [
            {"name": "Warmup", "sets": "1", "reps": "5 min"},
            {"name": data.workout_name + " Main", "sets": "3", "reps": "10-12"},
            {"name": "Accessory Movement", "sets": "3", "reps": "12-15"},
            {"name": "Cool Down", "sets": "1", "reps": "5 min"}
        ]}

@router.post("/analyze-goal")
async def analyze_goal(
    data: GoalAnalysisRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Analyze the user's weight goal and provide AI feedback."""
    profile_res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_res.scalars().first()
    unit = profile.measurement_unit if profile and getattr(profile, 'measurement_unit', None) else "metric"
    weight_unit = "lbs" if unit == "imperial" else "kg"

    prompt = f"""The user currently weighs {data.current_weight}kg and wants to reach a target weight of {data.target_weight}kg. Their timeline is: '{data.timeline}'. 
Please analyze this goal and provide your response as a valid JSON object ONLY, with exactly three keys:
1. "analysis": A brief, encouraging, and realistic analysis (MAX 2 short sentences). Ensure any weight values mentioned in your analysis are converted to and explicitly labeled as {weight_unit}.
2. "suggested_calories": An integer representing the recommended daily calorie intake.
3. "suggested_steps": An integer representing the recommended daily steps.
Output ONLY the raw JSON object, no markdown formatting, no backticks.
"""
    
    response = await generate_ai_response("fitness", prompt, max_tokens=200)
    
    try:
        import re
        import json
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            json_str = match.group(0)
            parsed = json.loads(json_str)
            return {
                "analysis": parsed.get("analysis", response),
                "suggested_calories": parsed.get("suggested_calories"),
                "suggested_steps": parsed.get("suggested_steps")
            }
        else:
            raise ValueError("No JSON block found")
    except Exception:
        # Fallback if AI fails to return proper JSON
        return {
            "analysis": response,
            "suggested_calories": 2000 if data.target_weight >= data.current_weight else 1500,
            "suggested_steps": 10000
        }
