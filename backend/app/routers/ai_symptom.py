"""
LifeOS Backend — AI Symptom Checker Router
"""

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.user import UserProfile
from app.models.disease import DiseaseLibrary, SymptomLibrary, SymptomCheckHistory, UserCustomSymptom
from app.models.emergency import AITriageLog
from app.schemas.chat import ConditionResult, SymptomAnalysisRequest, SymptomAnalysisResponse, SymptomValidationRequest, SymptomValidationResponse
from app.services.ai_service import generate_ai_response, generate_json_response

logger = logging.getLogger("lifeos.ai.symptom")
router = APIRouter(prefix="/ai/symptoms", tags=["AI Symptom Checker"])

# Symptom-condition mapping (fallback database matching frontend)
SYMPTOM_CONDITIONS = {
    "headache": [
        {"condition": "Tension Headache", "probability": 60, "specialists": ["Neurologist"]},
        {"condition": "Migraine", "probability": 30, "specialists": ["Neurologist"]},
        {"condition": "Sinusitis", "probability": 20, "specialists": ["ENT Specialist"]},
    ],
    "fever": [
        {"condition": "Viral Infection", "probability": 70, "specialists": ["General Physician"]},
        {"condition": "Bacterial Infection", "probability": 30, "specialists": ["General Physician"]},
        {"condition": "Dengue Fever", "probability": 15, "specialists": ["Infectious Disease"]},
    ],
    "cough": [
        {"condition": "Common Cold", "probability": 60, "specialists": ["General Physician"]},
        {"condition": "Bronchitis", "probability": 25, "specialists": ["Pulmonologist"]},
        {"condition": "Allergic Rhinitis", "probability": 20, "specialists": ["Allergist"]},
    ],
    "chest pain": [
        {"condition": "Acid Reflux (GERD)", "probability": 40, "specialists": ["Gastroenterologist"]},
        {"condition": "Muscle Strain", "probability": 30, "specialists": ["General Physician"]},
        {"condition": "Cardiac Issue", "probability": 15, "specialists": ["Cardiologist"]},
    ],
    "stomach pain": [
        {"condition": "Gastritis", "probability": 50, "specialists": ["Gastroenterologist"]},
        {"condition": "Food Poisoning", "probability": 30, "specialists": ["General Physician"]},
        {"condition": "Appendicitis", "probability": 10, "specialists": ["Surgeon"]},
    ],
    "fatigue": [
        {"condition": "Iron Deficiency", "probability": 40, "specialists": ["Hematologist"]},
        {"condition": "Thyroid Disorder", "probability": 25, "specialists": ["Endocrinologist"]},
        {"condition": "Vitamin D Deficiency", "probability": 35, "specialists": ["General Physician"]},
    ],
    "back pain": [
        {"condition": "Muscle Strain", "probability": 55, "specialists": ["Orthopedist"]},
        {"condition": "Herniated Disc", "probability": 20, "specialists": ["Orthopedist", "Neurologist"]},
        {"condition": "Poor Posture", "probability": 40, "specialists": ["Physiotherapist"]},
    ],
    "dizziness": [
        {"condition": "Low Blood Pressure", "probability": 35, "specialists": ["Cardiologist"]},
        {"condition": "Inner Ear Issue", "probability": 25, "specialists": ["ENT Specialist"]},
        {"condition": "Dehydration", "probability": 45, "specialists": ["General Physician"]},
    ],
}


@router.post("/custom", response_model=str)
async def add_custom_symptom(
    data: SymptomValidationRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Add a new custom symptom for the current user and translate it."""
    symptom_name = data.symptom.strip().lower()
    
    # Check if already exists
    result = await db.execute(
        select(UserCustomSymptom).where(
            UserCustomSymptom.user_id == user_id, 
            UserCustomSymptom.name == symptom_name
        )
    )
    if result.scalars().first():
        return "Already exists"
        
    # Translate on the fly
    translations = {}
    try:
        from app.services.ai_service import generate_ai_response
        prompt = f"Translate the medical symptom '{symptom_name}' into Gujarati and Hindi. Return ONLY valid JSON format like: {{\"gu\": \"gujarati translation\", \"hi\": \"hindi translation\"}}"
        ai_res = await generate_ai_response([{"role": "user", "content": prompt}], "llama-3.3-70b-versatile")
        
        # Parse JSON
        import json
        import re
        json_match = re.search(r'\{.*\}', ai_res, re.DOTALL)
        if json_match:
            translations = json.loads(json_match.group(0))
    except Exception as e:
        logger.error(f"Failed to translate custom symptom: {e}")
        
    translations['en'] = symptom_name
    
    entry = UserCustomSymptom(user_id=user_id, name=symptom_name, translations=translations)
    db.add(entry)
    await db.flush()
    return "Added"

@router.get("/custom", response_model=list[str])
async def get_custom_symptoms(
    user_id: CurrentUserId, lang: str = "en", db: AsyncSession = Depends(get_db)
):
    """Get all custom symptoms for the current user, translated if requested."""
    result = await db.execute(
        select(UserCustomSymptom).where(UserCustomSymptom.user_id == user_id)
        .order_by(UserCustomSymptom.created_at.desc())
    )
    symptoms = result.scalars().all()
    
    translated_symptoms = []
    for s in symptoms:
        if s.translations and lang in s.translations:
            translated_symptoms.append(s.translations[lang])
        else:
            translated_symptoms.append(s.name)
            
    return translated_symptoms

@router.delete("/custom")
async def delete_custom_symptom(
    data: SymptomValidationRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Delete a custom symptom for the current user."""
    symptom_name = data.symptom.strip().lower()
    
    # We might need to match the translation or the original english name.
    # The safest way is to delete if name matches OR if any translation matches.
    # Since we only get the string the user clicked on, which might be translated.
    result = await db.execute(
        select(UserCustomSymptom).where(UserCustomSymptom.user_id == user_id)
    )
    symptoms = result.scalars().all()
    
    for s in symptoms:
        if s.name == symptom_name or (s.translations and symptom_name in s.translations.values()):
            await db.delete(s)
            await db.commit()
            return {"status": "deleted"}
            
    return {"status": "not found"}

@router.post("/validate", response_model=SymptomValidationResponse)
async def validate_symptom(data: SymptomValidationRequest):
    """Fast AI validation to check if a string is a legitimate medical symptom."""
    prompt = (
        f"Analyze the following text: '{data.symptom}'\n"
        "Is this a valid medical symptom, medical condition, or a reasonable description of physical/mental discomfort?\n"
        "Return a JSON object with exactly two keys: 'is_valid' (boolean) and 'reason' (string explaining why if invalid, or null if valid). "
        "For example, 'hello', 'test', 'gibberish' should return false. 'my head hurts', 'blurry vision', 'fever' should return true."
    )
    
    ai_response = await generate_json_response("symptom_validate", prompt)
    
    try:
        return SymptomValidationResponse(
            is_valid=ai_response.get("is_valid", True),
            reason=ai_response.get("reason")
        )
    except Exception as e:
        logger.error(f"Validation JSON decode failed: {e}. Raw response: {ai_response}")
        # Fallback to true if AI fails so we don't break the app
        return SymptomValidationResponse(is_valid=True)

@router.post("/analyze", response_model=SymptomAnalysisResponse)
async def analyze_symptoms(
    data: SymptomAnalysisRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)
):
    """Analyze symptoms and suggest possible conditions."""
    # Get profile context
    profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()
    context = ""
    if profile:
        context = f"Patient: Age {profile.age}, Gender: {profile.gender}, Conditions: {', '.join(profile.conditions) if profile.conditions else 'None'}, Allergies: {', '.join(profile.allergies) if profile.allergies else 'None'}"

    # Fetch all custom diseases from DiseaseLibrary
    disease_query = select(DiseaseLibrary)
    disease_result = await db.execute(disease_query)
    diseases = disease_result.scalars().all()
    if diseases:
        disease_list = [f"{d.name} (Symptoms: {', '.join(d.symptoms) if isinstance(d.symptoms, list) else ''})" for d in diseases]
        context += "\n\nKnown Database Diseases:\n" + "\n".join(disease_list)

    requested_lang = "English"
    if data.language and data.language.lower() not in ["en", "english"]:
        requested_lang = data.language.upper()
        
    lang_instruction = f" (CRITICAL: You MUST write ALL output text, conditions, and recommendations ENTIRELY in {requested_lang})"

    # Try Groq AI first
    prompt = (
        f"Analyze these symptoms: {', '.join(data.symptoms)}\n"
        f"Duration: {data.duration}\n"
        f"Severity: {data.severity}\n"
        f"Age Group: {data.age_group}\n\n"
        "Consider the Patient Context and Known Database Diseases provided.\n"
        "IMPORTANT: If the provided symptoms are conversational (e.g. 'hello'), gibberish, or completely non-medical, "
        "you MUST return a JSON object with exactly one key: 'error' containing a descriptive message.\n"
        "Otherwise, respond with a JSON object containing:\n"
        '- urgency: "Low", "Medium", or "High" (MUST be exactly these English words)\n'
        f"- conditions: list of {{condition{lang_instruction}, probability (int 0-100)}}\n"
        f"- specialists: list of specialist types{lang_instruction}\n"
        f"- recommendations: list of actionable advice{lang_instruction}\n"
        "Only return valid JSON, no markdown."
    )

    system_prompt = "You are a professional medical AI triage assistant. You provide possible conditions, not definitive diagnoses. Always be safe and recommend a doctor if unsure."
    if data.language and data.language.lower() != "en" and data.language.lower() != "english":
        system_prompt += f" CRITICAL INSTRUCTION: You MUST translate all generated condition names, specialists, and recommendations into {data.language.upper()} language. If you output English for these fields, the system will fail."

    ai_response = await generate_ai_response("symptom", prompt, context=context)

    response = None

    # Try to parse AI response as JSON
    try:
        parsed = json.loads(ai_response)
        
        if "error" in parsed:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=parsed["error"])
            
        conditions = [ConditionResult(
            condition=c.get("condition", "Unknown"),
            probability=c.get("probability", 0),
            matched_symptoms=len(data.symptoms),
        ) for c in parsed.get("conditions", [])]

        from pydantic import ValidationError
        try:
            response = SymptomAnalysisResponse(
                urgency=parsed.get("urgency", "Medium") or "Medium",
                symptoms_analyzed=data.symptoms,
                conditions=conditions,
                specialists=parsed.get("specialists") or ["General Physician"],
                recommendations=parsed.get("recommendations") or ["Consult a doctor"],
            )
        except ValidationError as ve:
            logger.error(f"Pydantic Validation Error on AI response: {ve}")
            response = None
            
    except (json.JSONDecodeError, TypeError, AttributeError) as e:
        logger.info(f"AI response not JSON or malformed, using fallback symptom analysis: {e}")

    if not response:
        # Fallback: local symptom-condition matching
        conditions = []
        specialists = set()
        urgency = "Low"

        for symptom in data.symptoms:
            s_lower = symptom.lower()
            for key, conds in SYMPTOM_CONDITIONS.items():
                if key in s_lower or s_lower in key:
                    for c in conds:
                        conditions.append(ConditionResult(
                            condition=c["condition"],
                            probability=c["probability"],
                            matched_symptoms=1,
                        ))
                        specialists.update(c["specialists"])
            
            # Match against dynamic diseases
            for d in diseases:
                if isinstance(d.symptoms, list):
                    if any(s_lower in sym.lower() for sym in d.symptoms):
                        conditions.append(ConditionResult(
                            condition=d.name,
                            probability=60,
                            matched_symptoms=1
                        ))
                        specialists.add("General Physician")

        if not conditions:
            conditions.append(ConditionResult(
                condition="General assessment needed", probability=0, matched_symptoms=len(data.symptoms),
            ))
            specialists.add("General Physician")

        # Deduplicate and sort conditions
        seen = set()
        unique_conditions = []
        for c in sorted(conditions, key=lambda x: x.probability, reverse=True):
            if c.condition not in seen:
                seen.add(c.condition)
                unique_conditions.append(c)

        # Determine urgency
        if data.severity in ["Severe", "Very Severe"] or "chest pain" in " ".join(data.symptoms).lower():
            urgency = "High"
        elif data.severity == "Moderate" or len(data.symptoms) >= 3:
            urgency = "Medium"

        recommendations = [
            "Stay hydrated and get adequate rest",
            "Monitor your symptoms for any changes",
            "Keep a symptom diary for your doctor visit",
        ]
        if urgency == "High":
            recommendations.insert(0, "⚠️ Seek immediate medical attention")

        response = SymptomAnalysisResponse(
            urgency=urgency,
            symptoms_analyzed=data.symptoms,
            conditions=unique_conditions[:5],
            specialists=list(specialists),
            recommendations=recommendations,
        )

    if data.symptoms:
        try:
            # Also log the full symptom check history
            history_entry = SymptomCheckHistory(
                user_id=user_id,
                symptoms=data.symptoms,
                duration=data.duration,
                severity=data.severity,
                age_group=data.age_group,
                predicted_conditions=[{"condition": c.condition, "probability": c.probability} for c in response.conditions],
                urgency=response.urgency
            )
            db.add(history_entry)
            
            # Save exact AITriageLog for Admin Health Dashboard
            triage_log = AITriageLog(
                user_id=user_id,
                symptom=", ".join(data.symptoms),
                response=response.model_dump()
            )
            db.add(triage_log)
            
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to save symptom history/triage log to DB: {e}")
            await db.rollback()

    return response
