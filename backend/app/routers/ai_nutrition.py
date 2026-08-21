"""
LifeOS Backend — AI Nutrition Planner Router
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.user import UserProfile
from app.schemas.chat import NutritionPlanResponse
from app.services.ai_service import generate_ai_response
from app.utils.helpers import calculate_bmi, calculate_bmr, calculate_tdee, get_bmi_category

router = APIRouter(prefix="/ai/nutrition", tags=["AI Nutrition"])

# Default meal plans (matching frontend)
DEFAULT_MEALS = {
    "breakfast": [
        {"name": "Oatmeal with Fruits", "calories": 350, "protein": 12, "icon": "🥣", "time": "7:30 AM", "image_url": "/uploads/meals/oatmeal_fruits.png"},
        {"name": "Egg White Omelette", "calories": 280, "protein": 22, "icon": "🍳", "time": "7:30 AM", "image_url": "/uploads/meals/egg_white_omelette.png"},
        {"name": "Greek Yogurt Bowl", "calories": 300, "protein": 18, "icon": "🥛", "time": "7:30 AM", "image_url": "/uploads/meals/greek_yogurt_bowl.png"},
        {"name": "Poha with Vegetables", "calories": 250, "protein": 8, "icon": "🍚", "time": "7:30 AM", "image_url": "/uploads/meals/poha_vegetables.png"},
        {"name": "Vegetable Upma", "calories": 270, "protein": 6, "icon": "🍲", "time": "7:30 AM", "image_url": "/uploads/meals/vegetable_upma.png"},
        {"name": "Moong Dal Chilla", "calories": 310, "protein": 14, "icon": "🥞", "time": "7:30 AM", "image_url": "/uploads/meals/moong_dal_chilla.png"},
        {"name": "Avocado Whole Wheat Toast", "calories": 340, "protein": 8, "icon": "🥑", "time": "7:30 AM", "image_url": "/uploads/meals/avocado_toast.png"},
        {"name": "Idli with Sambar", "calories": 280, "protein": 9, "icon": "🍛", "time": "7:30 AM", "image_url": "/uploads/meals/idli_sambar.png"},
        {"name": "Peanut Butter Banana Toast", "calories": 350, "protein": 11, "icon": "🍞", "time": "7:30 AM", "image_url": "/uploads/meals/pb_banana_toast.png"},
        {"name": "Sprouts Salad", "calories": 200, "protein": 12, "icon": "🥗", "time": "7:30 AM", "image_url": "/uploads/meals/sprouts_salad.png"},
    ],
    "lunch": [
        {"name": "Grilled Chicken Salad", "calories": 450, "protein": 35, "icon": "🥗", "time": "12:30 PM", "image_url": "/uploads/meals/grilled_chicken_salad.png"},
        {"name": "Dal Rice with Veggies", "calories": 500, "protein": 18, "icon": "🍛", "time": "12:30 PM", "image_url": "/uploads/meals/dal_rice_veggies.png"},
        {"name": "Quinoa Buddha Bowl", "calories": 420, "protein": 16, "icon": "🥙", "time": "12:30 PM", "image_url": "/uploads/meals/quinoa_buddha_bowl.png"},
        {"name": "Chole with Brown Rice", "calories": 480, "protein": 18, "icon": "🍲", "time": "12:30 PM", "image_url": "/uploads/meals/chole_brown_rice.png"},
        {"name": "Brown Rice with Rajma", "calories": 460, "protein": 17, "icon": "🍛", "time": "12:30 PM", "image_url": "/uploads/meals/rajma_brown_rice.png"},
        {"name": "Paneer & Mixed Vegetable Curry", "calories": 440, "protein": 16, "icon": "🥘", "time": "12:30 PM", "image_url": "/uploads/meals/paneer_veg_curry.png"},
        {"name": "Grilled Fish with Brown Rice", "calories": 410, "protein": 33, "icon": "🐟", "time": "12:30 PM", "image_url": "/uploads/meals/grilled_fish_rice.png"},
        {"name": "Chickpea Salad Bowl", "calories": 390, "protein": 15, "icon": "🥗", "time": "12:30 PM", "image_url": "/uploads/meals/chickpea_salad.png"},
        {"name": "Whole Wheat Roti with Dal & Sabzi", "calories": 470, "protein": 19, "icon": "🫓", "time": "12:30 PM", "image_url": "/uploads/meals/roti_dal_sabzi.png"},
        {"name": "Tofu Stir Fry with Rice", "calories": 420, "protein": 22, "icon": "🍲", "time": "12:30 PM", "image_url": "/uploads/meals/tofu_stir_fry.png"},
        {"name": "Grilled Paneer Salad", "calories": 350, "protein": 20, "icon": "🥗", "time": "12:30 PM", "image_url": "/uploads/meals/paneer_veg_curry.png"},
    ],
    "snack": [
        {"name": "Handful of Almonds", "calories": 160, "protein": 6, "icon": "🥜", "time": "4:00 PM", "image_url": "/uploads/meals/handful_almonds.png"},
        {"name": "Banana Protein Shake", "calories": 220, "protein": 15, "icon": "🍌", "time": "4:00 PM", "image_url": "/uploads/meals/banana_protein_shake.png"},
        {"name": "Protein Smoothie", "calories": 250, "protein": 20, "icon": "🥤", "time": "4:00 PM", "image_url": "/uploads/meals/banana_protein_shake.png"},
        {"name": "Greek Yogurt with Berries", "calories": 180, "protein": 12, "icon": "🍓", "time": "4:00 PM", "image_url": "/uploads/meals/greek_yogurt_bowl.png"},
        {"name": "Roasted Chickpeas", "calories": 150, "protein": 7, "icon": "🍘", "time": "4:00 PM", "image_url": "/uploads/meals/handful_almonds.png"},
        {"name": "Mixed Nuts & Seeds", "calories": 190, "protein": 6, "icon": "🌰", "time": "4:00 PM", "image_url": "/uploads/meals/handful_almonds.png"},
        {"name": "Cottage Cheese Cubes", "calories": 140, "protein": 11, "icon": "🧀", "time": "4:00 PM", "image_url": "/uploads/meals/handful_almonds.png"},
        {"name": "Fruit Chaat", "calories": 120, "protein": 2, "icon": "🍎", "time": "4:00 PM", "image_url": "/uploads/meals/sprouts_salad.png"},
        {"name": "Boiled Corn Cup", "calories": 130, "protein": 4, "icon": "🌽", "time": "4:00 PM", "image_url": "/uploads/meals/handful_almonds.png"},
        {"name": "Whole Wheat Veg Sandwich", "calories": 260, "protein": 8, "icon": "🥪", "time": "4:00 PM", "image_url": "/uploads/meals/pb_banana_toast.png"},
    ],
    "dinner": [
        {"name": "Grilled Fish & Veggies", "calories": 380, "protein": 32, "icon": "🐟", "time": "7:30 PM", "image_url": "/uploads/meals/grilled_fish_veggies.png"},
        {"name": "Paneer Tikka with Roti", "calories": 450, "protein": 22, "icon": "🫓", "time": "7:30 PM", "image_url": "/uploads/meals/paneer_tikka_roti.png"},
        {"name": "Soup & Multigrain Toast", "calories": 300, "protein": 12, "icon": "🍲", "time": "7:30 PM", "image_url": "/uploads/meals/soup_multigrain_toast.png"},
        {"name": "Grilled Chicken with Steamed Vegetables", "calories": 390, "protein": 35, "icon": "🍗", "time": "7:30 PM", "image_url": "/uploads/meals/grilled_fish_veggies.png"},
        {"name": "Mixed Vegetable Soup", "calories": 180, "protein": 6, "icon": "🥣", "time": "7:30 PM", "image_url": "/uploads/meals/soup_multigrain_toast.png"},
        {"name": "Zucchini Noodles with Tomato Sauce", "calories": 220, "protein": 5, "icon": "🍝", "time": "7:30 PM", "image_url": "/uploads/meals/tofu_stir_fry.png"},
        {"name": "Moong Dal Khichdi", "calories": 350, "protein": 14, "icon": "🍚", "time": "7:30 PM", "image_url": "/uploads/meals/dal_rice_veggies.png"},
        {"name": "Brown Rice with Dal", "calories": 420, "protein": 16, "icon": "🍛", "time": "7:30 PM", "image_url": "/uploads/meals/dal_rice_veggies.png"},
        {"name": "Vegetable Oats Khichdi", "calories": 310, "protein": 10, "icon": "🍲", "time": "7:30 PM", "image_url": "/uploads/meals/dal_rice_veggies.png"},
        {"name": "Whole Wheat Roti with Paneer Bhurji", "calories": 460, "protein": 24, "icon": "🫓", "time": "7:30 PM", "image_url": "/uploads/meals/paneer_tikka_roti.png"},
    ],
}

@router.get("/plan", response_model=NutritionPlanResponse)
async def get_nutrition_plan(user_id: CurrentUserId, db: AsyncSession = Depends(get_db), force_regenerate: bool = False):
    """Get personalized nutrition plan based on user profile."""
    profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()

    weight = profile.weight if profile else 70
    height = profile.height if profile else 170
    age = profile.age if profile else 30
    gender = profile.gender if profile else "Male"

    bmi = calculate_bmi(weight, height)
    bmr = calculate_bmr(weight, height, age, gender)
    tdee = profile.calorie_goal if profile and getattr(profile, 'calorie_goal', None) else calculate_tdee(bmr, "moderate")
    water_goal = round(weight * 0.033, 1)
    protein_goal = round(weight * 1.2)

    from app.models.diet import MealPlan
    latest_plan_result = await db.execute(
        select(MealPlan)
        .where(MealPlan.user_id == user_id, MealPlan.source == "AI")
        .order_by(MealPlan.created_at.desc())
        .limit(1)
    )
    latest_plan = latest_plan_result.scalar_one_or_none()

    if not force_regenerate and latest_plan and latest_plan.meals_data:
        # Filter out scanned meals from the cached plan so they don't persist forever
        meals = [m for m in latest_plan.meals_data if str(m.get("meal_type")).lower() != "scanned snack"]
        
        # Inject missing image URLs for backwards compatibility with older plans
        for meal in meals:
            if not meal.get("image_url"):
                for meal_options in DEFAULT_MEALS.values():
                    for opt in meal_options:
                        if opt["name"] == meal.get("name"):
                            meal["image_url"] = opt.get("image_url")
                            break
    else:
        import random
        meals = []
        for meal_type, options in DEFAULT_MEALS.items():
            chosen = random.choice(options)
            meals.append({**chosen, "meal_type": meal_type})

    from sqlalchemy import func, cast, Date as SADate
    from app.models.diet import ScannedMeal
    from datetime import datetime
    
    today = datetime.now().date()
    scanned_meals_result = await db.execute(
        select(ScannedMeal)
        .where(ScannedMeal.user_id == user_id)
        .where(cast(ScannedMeal.recorded_at, SADate) == today)
    )
    scanned_meals = scanned_meals_result.scalars().all()
    
    consumed_calories = 0
    consumed_protein = 0
    consumed_carbs = 0
    consumed_fats = 0

    for sm in scanned_meals:
        if sm.is_deleted:
            continue
            
        consumed_calories += sm.calories or 0
        consumed_protein += sm.protein or 0
        consumed_carbs += sm.carbs or 0
        consumed_fats += sm.fats or 0

        # Try to match with an existing planned meal
        matched = False
        for m in meals:
            # Match by name
            if m.get("name") == sm.name and not m.get("is_consumed"):
                m["is_consumed"] = True
                m["consumed_id"] = sm.id
                m["recorded_at"] = int(sm.recorded_at.timestamp() * 1000) if sm.recorded_at else None
                matched = True
                break
        
        if not matched:
            time_of_day = "Unknown"
            if sm.recorded_at:
                hour = sm.recorded_at.hour
                if 5 <= hour < 12:
                    time_of_day = "Morning"
                elif 12 <= hour < 17:
                    time_of_day = "Afternoon"
                elif 17 <= hour < 21:
                    time_of_day = "Evening"
                else:
                    time_of_day = "Night"

            meals.append({
                "id": sm.id,
                "meal_type": sm.meal_type or "scanned snack",
                "time": f"{time_of_day} ({sm.recorded_at.strftime('%I:%M %p')})" if sm.recorded_at else "Unknown",
                "recorded_at": int(sm.recorded_at.timestamp() * 1000) if sm.recorded_at else None,
                "name": sm.name,
                "calories": sm.calories,
                "protein": sm.protein,
                "carbs": sm.carbs,
                "fats": sm.fats,
                "is_deleted": sm.is_deleted,
                "is_consumed": True,
                "consumed_id": sm.id,
                "icon": "📸",
                "image_url": sm.image_url
            })

    consumed_macros = {
        "calories": consumed_calories,
        "protein": consumed_protein,
        "carbs": consumed_carbs,
        "fats": consumed_fats,
    }
    macro_breakdown = {
        "protein": {"grams": protein_goal, "percentage": 25, "color": "#FF6B6B"},
        "carbs": {"grams": round(tdee * 0.50 / 4), "percentage": 50, "color": "#FDCB6E"},
        "fats": {"grams": round(tdee * 0.25 / 9), "percentage": 25, "color": "#00D2D3"},
    }

    unit = profile.measurement_unit if profile and getattr(profile, 'measurement_unit', None) else "metric"
    weight_display = weight
    weight_unit_label = "kg"
    if unit == "imperial":
        weight_display = round(weight * 2.20462, 1)
        weight_unit_label = "lbs"

    return NutritionPlanResponse(
        tdee=tdee,
        water_goal_liters=water_goal,
        protein_goal_grams=protein_goal,
        bmi=bmi,
        bmi_category=get_bmi_category(bmi),
        meals=meals,
        macro_breakdown=macro_breakdown,
        recommendations=[
            {"icon": "💧", "text": f"Drink {water_goal}L of water daily (based on your {weight_display}{weight_unit_label} weight)"},
            {"icon": "🥩", "text": f"Aim for {protein_goal}g of protein daily for muscle maintenance"},
            {"icon": "🥗", "text": "Eat 5 servings of fruits and vegetables daily"},
            {"icon": "🕐", "text": "Eat meals at regular intervals. Don't skip breakfast."},
        ],
        consumed_macros=consumed_macros,
    )


@router.post("/regenerate", response_model=NutritionPlanResponse)
async def regenerate_plan(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Regenerate meal plan with different options and save to history."""
    plan_response = await get_nutrition_plan(user_id=user_id, db=db, force_regenerate=True)
    
    from app.models.diet import MealPlan, Recipe
    from datetime import datetime
    
    new_plan = MealPlan(
        title=f"AI Plan - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        description="Personalized auto-generated meal plan.",
        goal="Maintenance",
        daily_calorie_target=plan_response.tdee,
        status="Published",
        meals_data=plan_response.meals,
        source="AI",
        user_id=user_id
    )
    db.add(new_plan)
    
    # Also save the individual meals to the Recipes dictionary so they show up in Admin Meals
    from sqlalchemy import select
    for meal in plan_response.meals:
        existing = await db.execute(select(Recipe).where(Recipe.title == meal["name"]))
        if not existing.scalar_one_or_none():
            new_recipe = Recipe(
                title=meal["name"],
                description=f"AI recommended {meal.get('meal_type', 'meal')} option",
                meal_type=meal.get("meal_type", "Lunch").title(),
                calories=meal.get("calories", 0),
                protein=meal.get("protein", 0),
                status="Published",
            )
            db.add(new_recipe)

    await db.commit()
    
    return plan_response


@router.get("/stats")
async def nutrition_stats(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get nutrition stats (TDEE, macros, water goal)."""
    profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()

    weight = profile.weight if profile else 70
    height = profile.height if profile else 170
    age = profile.age if profile else 30
    gender = profile.gender if profile else "Male"

    bmr = calculate_bmr(weight, height, age, gender)
    tdee = profile.calorie_goal if profile and getattr(profile, 'calorie_goal', None) else calculate_tdee(bmr, "moderate")
    
    return {
        "bmr": bmr,
        "tdee_sedentary": calculate_tdee(bmr, "sedentary"),
        "tdee_light": calculate_tdee(bmr, "light"),
        "tdee_moderate": tdee,
        "tdee_active": calculate_tdee(bmr, "very_active"),
        "water_goal_liters": round(weight * 0.033, 1),
        "protein_goal_grams": round(weight * 1.2),
    }


@router.post("/recommendations")
async def ai_diet_recommendations(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Get AI-powered diet recommendations."""
    profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()

    context = ""
    if profile:
        bmi = calculate_bmi(profile.weight, profile.height)
        context = f"Patient: {profile.name}, Age: {profile.age}, Gender: {profile.gender}, BMI: {bmi}, Conditions: {', '.join(profile.conditions) if profile.conditions else 'None'}, Allergies: {', '.join(profile.allergies) if profile.allergies else 'None'}"

    response = await generate_ai_response(
        "nutrition",
        "Provide personalized diet recommendations based on my profile. Include Indian food options.",
        context=context,
    )
    return {"recommendations": response}
@router.delete("/scan/{meal_id}")
async def delete_scanned_meal(
    meal_id: str,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db)
):
    from app.models.diet import ScannedMeal
    from sqlalchemy import select
    result = await db.execute(select(ScannedMeal).where(ScannedMeal.id == meal_id, ScannedMeal.user_id == user_id))
    meal = result.scalar_one_or_none()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    meal.is_deleted = True
    await db.commit()
    return {"success": True, "message": "Meal deleted"}

from pydantic import BaseModel
class ConsumeMealRequest(BaseModel):
    name: str
    calories: int
    protein: int
    carbs: int = 0
    fats: int = 0
    meal_type: str = "snack"
    image_url: str = None

@router.post("/consume")
async def consume_meal(
    data: ConsumeMealRequest,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db)
):
    from app.models.diet import ScannedMeal
    sm = ScannedMeal(
        user_id=user_id,
        name=data.name,
        calories=data.calories,
        protein=data.protein,
        carbs=data.carbs,
        fats=data.fats,
        meal_type=data.meal_type,
        image_url=data.image_url,
        is_deleted=False
    )
    db.add(sm)
    await db.commit()
    await db.refresh(sm)
    return {"success": True, "id": sm.id}
