"""
Gamification API Router
"""

from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models.gamification import UserGamification
from app.models.user import User
from app.models.medicine import MedicineLog
from app.models.health_tracker import HealthEntry, SleepEntry
from app.models.diet import ScannedMeal
from app.models.challenge import CommunityChallenge, ChallengeProgress, UserBadge

router = APIRouter(prefix="/gamification", tags=["Gamification"])

BADGE_DEFINITIONS = [
    {
        "id": "b1", "name": "Medication Master", "icon": "💊", "desc": "7-day medication streak", 
        "target": 7,
        "progress": lambda g, s: g.streaks.get("medication", {}).get("best", 0),
        "condition": lambda g, s: g.streaks.get("medication", {}).get("best", 0) >= 7
    },
    {
        "id": "b2", "name": "Streak Starter", "icon": "🔥", "desc": "3-day health streak", 
        "target": 3,
        "progress": lambda g, s: max([x.get("best", 0) for x in g.streaks.values()] + [0]),
        "condition": lambda g, s: any(x.get("best", 0) >= 3 for x in g.streaks.values())
    },
    {
        "id": "b3", "name": "Step Champion", "icon": "👟", "desc": "Reach 10,000 steps", 
        "target": 10000,
        "progress": lambda g, s: s.get("max_steps", 0),
        "condition": lambda g, s: s.get("max_steps", 0) >= 10000
    },
    {
        "id": "b4", "name": "Workout Warrior", "icon": "💪", "desc": "Complete 10 workouts", 
        "target": 10,
        "progress": lambda g, s: s.get("total_workouts", 0),
        "condition": lambda g, s: s.get("total_workouts", 0) >= 10
    },
    {
        "id": "b5", "name": "Nutrition Pro", "icon": "🥗", "desc": "Meet nutrition goal 14 days", 
        "target": 14,
        "progress": lambda g, s: g.streaks.get("nutrition", {}).get("best", 0),
        "condition": lambda g, s: g.streaks.get("nutrition", {}).get("best", 0) >= 14
    },
    {
        "id": "b6", "name": "Consistency King", "icon": "🏆", "desc": "Maintain a 30-day health streak", 
        "target": 30,
        "progress": lambda g, s: max([x.get("best", 0) for x in g.streaks.values()] + [0]),
        "condition": lambda g, s: any(x.get("best", 0) >= 30 for x in g.streaks.values())
    },
]

def _calc_streak_and_best(dates_list: list[date], ref_date: date) -> tuple[int, int]:
    if not dates_list:
        return 0, 0
    unique_dates = sorted(list(set(dates_list)), reverse=True)
    
    current_streak = 0
    if (ref_date - unique_dates[0]).days <= 1:
        expected_date = unique_dates[0]
        for d in unique_dates:
            if d == expected_date:
                current_streak += 1
                expected_date -= timedelta(days=1)
            else:
                break
                
    best_streak = 0
    temp_streak = 1
    for i in range(len(unique_dates) - 1):
        if (unique_dates[i] - unique_dates[i+1]).days == 1:
            temp_streak += 1
        else:
            if temp_streak > best_streak:
                best_streak = temp_streak
            temp_streak = 1
    if temp_streak > best_streak:
        best_streak = temp_streak
        
    return current_streak, max(current_streak, best_streak)

async def calculate_user_xp_and_streaks(db: AsyncSession, user: User) -> UserGamification:
    """Retroactively calculates XP and streaks from past data."""
    gamification_res = await db.execute(select(UserGamification).where(UserGamification.user_id == user.id))
    gamification = gamification_res.scalar_one_or_none()
    
    if not gamification:
        gamification = UserGamification(
            user_id=user.id,
            nickname=user.profile.name if user.profile else "Anonymous",
            xp=0,
            level=1
        )
        db.add(gamification)
        await db.flush()

    total_xp = 0
    today = date.today()
    
    # 1. Medication Logs
    med_res = await db.execute(
        select(MedicineLog.date)
        .where(MedicineLog.user_id == user.id, MedicineLog.status == "taken")
    )
    med_dates = []
    for d in med_res.scalars().all():
        if isinstance(d, str):
            try: med_dates.append(datetime.strptime(d, "%Y-%m-%d").date())
            except: pass
        elif isinstance(d, date):
            med_dates.append(d)
    
    # 2. Steps
    step_res = await db.execute(
        select(HealthEntry.recorded_at, HealthEntry.value)
        .where(HealthEntry.user_id == user.id, HealthEntry.category == "steps", HealthEntry.value >= 5000)
    )
    steps_data = step_res.all()
    step_dates = [d.date() for d, v in steps_data if d]
    
    # Calculate max steps for Step Champion badge
    all_steps_res = await db.execute(
        select(HealthEntry.value)
        .where(HealthEntry.user_id == user.id, HealthEntry.category == "steps")
    )
    all_steps_vals = [float(v) for v in all_steps_res.scalars().all() if v]
    max_steps = max(all_steps_vals) if all_steps_vals else 0
    
    # 3. Workouts (Calories burned entry)
    workout_res = await db.execute(
        select(HealthEntry.recorded_at)
        .where(HealthEntry.user_id == user.id, HealthEntry.category == "calories")
    )
    workout_dates = [d.date() for d in workout_res.scalars().all() if d]
    
    # 4. Nutrition (Scanned Meals)
    meal_res = await db.execute(
        select(ScannedMeal.recorded_at).where(ScannedMeal.user_id == user.id)
    )
    meal_dates = [d.date() for d in meal_res.scalars().all() if d]
    
    # 5. Sleep
    sleep_res = await db.execute(
        select(SleepEntry.date).where(SleepEntry.user_id == user.id, SleepEntry.hours >= 6)
    )
    sleep_dates = [d for d in sleep_res.scalars().all() if d]

    total_xp += len(med_dates) * 20
    total_xp += len(step_dates) * 25
    total_xp += len(meal_dates) * 20
    total_xp += len(sleep_dates) * 15
    total_xp += len(workout_dates) * 25

    gamification.xp = total_xp
    gamification.level = (total_xp // 500) + 1
    
    med_curr, med_best = _calc_streak_and_best(med_dates, today)
    step_curr, step_best = _calc_streak_and_best(step_dates, today)
    workout_curr, workout_best = _calc_streak_and_best(workout_dates, today)
    nutrition_curr, nutrition_best = _calc_streak_and_best(meal_dates, today)
    sleep_curr, sleep_best = _calc_streak_and_best(sleep_dates, today)

    # Completely recalculate from raw data, ignore old cached 'best' which may contain fake mock data
    gamification.streaks = {
        "medication": {"current": med_curr, "best": med_best, "last_date": str(today)},
        "workout": {"current": workout_curr, "best": workout_best, "last_date": str(today)},
        "steps": {"current": step_curr, "best": step_best, "last_date": str(today)},
        "nutrition": {"current": nutrition_curr, "best": nutrition_best, "last_date": str(today)},
        "sleep": {"current": sleep_curr, "best": sleep_best, "last_date": str(today)}
    }
    
    stats = {
        "max_steps": max_steps,
        "total_workouts": len(workout_dates)
    }
    
    # Check and award badges (or revoke if no longer meeting condition, based on user request)
    existing_badges_res = await db.execute(select(UserBadge).where(UserBadge.user_id == user.id))
    existing_badges_list = existing_badges_res.scalars().all()
    existing_badges_map = {b.badge_name: b for b in existing_badges_list}
    
    for bdef in BADGE_DEFINITIONS:
        is_earned = bdef["condition"](gamification, stats)
        if is_earned and bdef["name"] not in existing_badges_map:
            new_badge = UserBadge(user_id=user.id, badge_name=bdef["name"])
            db.add(new_badge)
        elif not is_earned and bdef["name"] in existing_badges_map:
            await db.delete(existing_badges_map[bdef["name"]])
    
    await db.commit()
    await db.refresh(gamification)
    return gamification


@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    """Fetch gamification profile, retroactive calculation on read for simplicity."""
    try:
        user_res = await db.execute(select(User).options(selectinload(User.profile)).where(User.id == user_id))
        current_user = user_res.scalar_one_or_none()
        
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        gamification = await calculate_user_xp_and_streaks(db, current_user)
        
        badges_res = await db.execute(select(UserBadge).where(UserBadge.user_id == current_user.id))
        earned_badges = {b.badge_name for b in badges_res.scalars().all()}
        
        # Calculate stats again for badge progress calculation
        all_steps_res = await db.execute(select(HealthEntry.value).where(HealthEntry.user_id == current_user.id, HealthEntry.category == "steps"))
        all_steps_vals = [float(v) for v in all_steps_res.scalars().all() if v]
        max_steps = max(all_steps_vals) if all_steps_vals else 0
        
        workout_res = await db.execute(select(HealthEntry.recorded_at).where(HealthEntry.user_id == current_user.id, HealthEntry.category == "calories"))
        total_workouts = len([d for d in workout_res.scalars().all() if d])
        
        stats = {
            "max_steps": max_steps,
            "total_workouts": total_workouts
        }
        
        all_badges = [
            {
                "id": bdef["id"], 
                "name": bdef["name"], 
                "icon": bdef["icon"], 
                "desc": bdef["desc"], 
                "earned": bdef["name"] in earned_badges,
                "progress": bdef["progress"](gamification, stats),
                "target": bdef["target"]
            }
            for bdef in BADGE_DEFINITIONS
        ]

        return {
            "success": True,
            "xp": gamification.xp,
            "level": gamification.level,
            "next_level_xp": gamification.level * 500,
            "streaks": gamification.streaks,
            "badges": all_badges,
            "nickname": gamification.nickname
        }
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@router.get("/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    """Fetch top users by XP."""
    try:
        users_res = await db.execute(select(User).options(selectinload(User.profile)).where(User.is_active == True))
        users = users_res.scalars().all()
        
        for u in users:
            await calculate_user_xp_and_streaks(db, u)
            
        top_res = await db.execute(
            select(UserGamification).options(selectinload(UserGamification.user).selectinload(User.profile)).order_by(UserGamification.xp.desc()).limit(20)
        )
        top_profiles = top_res.scalars().all()
        
        leaderboard = []
        current_user_rank = None
        
        for i, p in enumerate(top_profiles):
            rank = i + 1
            is_current = p.user_id == user_id
            if is_current:
                current_user_rank = rank
                
            leaderboard.append({
                "rank": rank,
                "nickname": "You" if is_current else p.nickname,
                "name": p.user.profile.name if p.user and p.user.profile else "Unknown",
                "email": p.user.email if p.user else "Unknown",
                "age": p.user.profile.age if p.user and p.user.profile else "Unknown",
                "gender": p.user.profile.gender if p.user and p.user.profile else "Unknown",
                "xp": p.xp,
                "level": p.level,
                "is_current": is_current,
                "avatar_url": p.user.profile.avatar_url if p.user and p.user.profile else None
            })
            
        return {
            "success": True,
            "leaderboard": leaderboard,
            "current_user_rank": current_user_rank
        }
    except Exception as e:
        import traceback
        return {"success": False, "error": f"Leaderboard Error: {str(e)}", "traceback": traceback.format_exc()}


@router.get("/challenges")
async def get_challenges(db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    """Fetch active community challenges and real user progress."""
    try:
        challenges_res = await db.execute(select(CommunityChallenge).where(CommunityChallenge.is_active == True))
        challenges = challenges_res.scalars().all()
        
        if not challenges:
            # Seed some default challenges to ensure the DB has data
            default_challenges = [
                CommunityChallenge(id="c1", title="7-Day Walking Challenge", goal_text="50,000 steps", target=50000, icon="👟", color="blue", participants_count=15),
                CommunityChallenge(id="c2", title="Healthy Eating Challenge", goal_text="Log 14 healthy meals", target=14, icon="🥗", color="emerald", participants_count=12),
                CommunityChallenge(id="c3", title="Medication Adherence", goal_text="Take meds on time for 7 days", target=7, icon="💊", color="rose", participants_count=14)
            ]
            db.add_all(default_challenges)
            await db.commit()
            challenges = default_challenges

        challenge_data = []
        today = date.today()
        seven_days_ago = today - timedelta(days=7)
        from datetime import timezone
        seven_days_ago_dt = datetime.combine(seven_days_ago, datetime.min.time(), tzinfo=timezone.utc)
        
        for c in challenges:
            user_progress = 0
            
            # Dynamically calculate progress based on challenge ID
            if c.id == "c1":
                # Sum of steps in the last 7 days
                step_res = await db.execute(
                    select(func.sum(HealthEntry.value))
                    .where(
                        HealthEntry.user_id == user_id, 
                        HealthEntry.category == "steps",
                        HealthEntry.recorded_at >= seven_days_ago_dt
                    )
                )
                user_progress = int(step_res.scalar() or 0)
                
            elif c.id == "c2":
                # Count of scanned meals in the last 7 days
                meal_res = await db.execute(
                    select(func.count(ScannedMeal.id))
                    .where(
                        ScannedMeal.user_id == user_id,
                        ScannedMeal.recorded_at >= seven_days_ago_dt
                    )
                )
                user_progress = int(meal_res.scalar() or 0)
                
            elif c.id == "c3":
                # Count of distinct days medication was taken in the last 7 days
                med_res = await db.execute(
                    select(func.count(func.distinct(MedicineLog.date)))
                    .where(
                        MedicineLog.user_id == user_id,
                        MedicineLog.status == "taken",
                        MedicineLog.date >= seven_days_ago
                    )
                )
                user_progress = int(med_res.scalar() or 0)
            else:
                # Fallback to ChallengeProgress if custom logic doesn't exist
                prog_res = await db.execute(
                    select(func.sum(ChallengeProgress.progress))
                    .where(ChallengeProgress.user_id == user_id, ChallengeProgress.challenge_id == c.id)
                )
                user_progress = int(prog_res.scalar() or 0)
            
            # Dynamically calculate total participants based on real data
            participants = 0
            if c.id == "c1":
                # Distinct users who logged steps in the last 7 days
                part_res = await db.execute(
                    select(func.count(func.distinct(HealthEntry.user_id)))
                    .where(
                        HealthEntry.category == "steps",
                        HealthEntry.recorded_at >= seven_days_ago_dt
                    )
                )
                participants = int(part_res.scalar() or 0)
            elif c.id == "c2":
                # Distinct users who logged meals in the last 7 days
                part_res = await db.execute(
                    select(func.count(func.distinct(ScannedMeal.user_id)))
                    .where(
                        ScannedMeal.recorded_at >= seven_days_ago_dt
                    )
                )
                participants = int(part_res.scalar() or 0)
            elif c.id == "c3":
                # Distinct users who took meds in the last 7 days
                part_res = await db.execute(
                    select(func.count(func.distinct(MedicineLog.user_id)))
                    .where(
                        MedicineLog.status == "taken",
                        MedicineLog.date >= seven_days_ago
                    )
                )
                participants = int(part_res.scalar() or 0)
            else:
                participants = c.participants_count

            challenge_data.append({
                "id": c.id,
                "title": c.title,
                "goal_text": c.goal_text,
                "participants": participants,
                "user_progress": min(user_progress, c.target), # Cap at target
                "target": c.target,
                "icon": c.icon,
                "color": c.color
            })
        
        return {
            "success": True,
            "challenges": challenge_data
        }
    except Exception as e:
        import traceback
        return {"success": False, "error": f"Challenges Error: {str(e)}", "traceback": traceback.format_exc()}
