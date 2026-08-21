"""
LifeOS Backend — AI Service (Groq Integration)
Central AI client with module-specific prompts and fallback responses.
"""

import logging
from typing import Optional
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.ai_prompt import AIPrompt
from app.models.admin import AIUsageLog
import time

logger = logging.getLogger("lifeos.ai")

settings = get_settings()

# ─── Groq Client Initialization ─────────────────────────────────────

_groq_client = None


def _get_groq_client():
    """Lazy-load the Groq client."""
    global _groq_client
    if _groq_client is None and settings.GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            logger.info("Groq AI client initialized successfully")
        except Exception as e:
            logger.warning("Failed to initialize Groq client: %s", e)
    return _groq_client


# ─── System Prompts ──────────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "assistant": (
        "Respond in clean, professional Markdown with a maximum of 6–8 lines by default. "
        "Keep answers concise and easy to scan. Use **bold** for medicine names, diseases, dosages, warnings, and key medical terms. "
        "Use short bullet points (not paragraphs) and never output a wall of text. "
        "Follow this format unless the user requests more details:\n\n"
        "**[Medicine/Disease Name]**\n\n"
        "**Overview:** One short sentence.\n"
        "**Uses:** 2–3 key uses.\n"
        "**Dosage:** Mention only the recommended dose (if applicable).\n"
        "**Side Effects:** List 2–3 common ones.\n"
        "**Warning:** One important precaution.\n"
        "**Summary:** One-line takeaway."
    ),
    "symptom": (
        "You are a medical symptom analysis AI. Given a list of symptoms, duration, and severity, "
        "provide: 1) Possible conditions with estimated likelihood percentages, "
        "2) Recommended medical specialists, 3) Urgency level (Low/Medium/High), "
        "4) General care recommendations. Always include a disclaimer that this is not a diagnosis. "
        "Format the response as structured JSON with keys: urgency, conditions (list of {condition, probability}), "
        "specialists (list), recommendations (list)."
    ),
    "symptom_validate": (
        "You are a medical triage filter. Only accept text that could reasonably describe a health issue."
    ),
    "nutrition": (
        "You are a nutrition expert AI. Based on user profile (age, weight, height, gender, conditions, allergies), "
        "provide personalized meal suggestions, dietary recommendations, and nutritional advice. "
        "Focus on Indian vegetarian cuisine when relevant. Include calorie and protein estimates."
    ),
    "fitness": (
        "You are a fitness coach AI. Provide personalized workout suggestions based on user profile. "
        "Include exercise descriptions, sets/reps, duration, and estimated calories burned. "
        "Consider any health conditions the user has. Offer motivation and safety tips."
    ),
    "mental": (
        "You are a compassionate mental health support AI. Analyze mood patterns and journal entries. "
        "Provide supportive insights, coping strategies, and wellness recommendations. "
        "For concerning patterns, always recommend professional help. "
        "Keep your response concise (under 4 paragraphs) and DO NOT repeat yourself. "
        "If recommending helplines, include Indian helpline numbers (iCall: 9152987821) exactly ONCE at the very end of your response."
    ),
    "mental_trend": (
        "You are a mental health trend analyzer. Given a list of recent journal entries (oldest to newest), "
        "determine if there is a concerning downward trend in the user's emotional state (e.g., increasing anxiety, depression, burnout). "
        "If the user shows a continuous downward trend or severe distress, recommend an action. "
        "Format the response as structured JSON with keys: 'trend_detected' (boolean), 'proactive_action' (string or null: e.g., 'suggest_meditation', 'alert_emergency', null if okay)."
    ),
    "report_parser": (
        "You are a highly accurate medical data extraction AI. Given the raw text extracted from a medical lab report, "
        "your job is to extract specific key health metrics and return them in a strict JSON format. "
        "Look for metrics like Hemoglobin (g/dL), Blood Sugar/Glucose (mg/dL), Total Cholesterol (mg/dL), "
        "HDL, LDL, Triglycerides, Vitamin D (ng/mL), Blood Pressure (Systolic/Diastolic mmHg), and Weight (kg). "
        "Format your response as a valid JSON object where keys are the metric names and values are the numeric findings. "
        "Do NOT include units in the values, just numbers. Example JSON: {\"Hemoglobin\": 14.2, \"Blood Sugar\": 95, \"Cholesterol\": 180}. "
        "If a metric is not found, do not include it in the JSON."
    ),
    "organ_suitability": (
        "You are an AI medical pre-screening assistant for organ donation. "
        "Based on the user's health profile and their questionnaire answers, evaluate their general suitability "
        "as an organ donor. Highlight any potential contraindications (like recent infections, severe conditions, heavy smoking/alcohol) "
        "and return a recommendation (Eligible, Proceed with Caution, Not Eligible) with concise reasons. "
        "Keep it professional, empathetic, and concise (3-4 paragraphs). "
        "Always include a disclaimer that this is only a preliminary AI assessment and final decisions are made by medical professionals at the time of donation."
    ),
    "interactions": (
        "You are a pharmacology AI expert. Your task is to identify known severe or moderate drug interactions between the provided list of medications. "
        "If there are ANY interactions, format the response strictly with bullet points starting with '* '. "
        "CRITICAL FORMATTING RULES: You MUST use markdown bold (e.g., **Medicine A + Medicine B**) for the medicine names at the very beginning of the bullet point. "
        "You MUST also use bold for keywords like **Precautions:** and **Side effects:**. "
        "If there are NO interactions between the medications, you MUST reply with exactly 'NO_INTERACTIONS' and nothing else."
    )
}


# ─── Core AI Function ────────────────────────────────────────────────

_dynamic_model = None

async def _get_best_model(client) -> str:
    global _dynamic_model
    if _dynamic_model:
        return _dynamic_model
    try:
        models_response = await client.models.list()
        model_ids = [m.id for m in models_response.data]
        
        # We MUST ONLY use openai/gpt-oss-120b for text models as requested by the user previously
        if "openai/gpt-oss-120b" in model_ids:
            _dynamic_model = "openai/gpt-oss-120b"
            return _dynamic_model
        # Priority 2: Gemma 2
        for m_id in model_ids:
            if "gemma2" in m_id.lower():
                _dynamic_model = m_id
                return _dynamic_model
        # Priority 3: Mixtral
        for m_id in model_ids:
            if "mixtral" in m_id.lower():
                _dynamic_model = m_id
                return _dynamic_model
                
        # If no preferred model found but there are models, pick the first one
        if model_ids:
            _dynamic_model = model_ids[0]
            return _dynamic_model
            
    except Exception as e:
        logger.warning("Failed to fetch dynamic models: %s", e)
    
    # Fallback to configured model if api fails
    _dynamic_model = "openai/gpt-oss-120b"
    return _dynamic_model


async def generate_ai_response(
    module: str,
    user_message: str,
    context: str = "",
    max_tokens: int = 1024,
) -> str:
    """
    Generate an AI response using Groq API.
    Falls back to a generic response if Groq is unavailable.
    """
    client = _get_groq_client()

    if client is None:
        logger.info("Groq client not available, using fallback response")
        return _get_fallback_response(module, user_message)

    system_prompt = SYSTEM_PROMPTS.get(module, SYSTEM_PROMPTS["assistant"])
    
    # Attempt to fetch from DB
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AIPrompt).where(AIPrompt.module == module, AIPrompt.is_active == True))
            prompt_obj = result.scalar_one_or_none()
            if prompt_obj and prompt_obj.content:
                system_prompt = prompt_obj.content
    except Exception as e:
        logger.error("Failed to fetch prompt from DB: %s", e)

    if context:
        system_prompt += f"\n\nUser Health Context:\n{context}"
        
    global _dynamic_model

    for attempt in range(3):
        current_model = await _get_best_model(client)
        try:
            start_t = time.time()
            chat_completion = await client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                model=current_model,
                temperature=0.7,
            )
            response = chat_completion.choices[0].message.content
            logger.info("Groq AI response generated for module: %s using model: %s", module, current_model)

            # Log AI Usage
            try:
                async with AsyncSessionLocal() as db:
                    pt = chat_completion.usage.prompt_tokens if hasattr(chat_completion, 'usage') and chat_completion.usage else 0
                    ct = chat_completion.usage.completion_tokens if hasattr(chat_completion, 'usage') and chat_completion.usage else 0
                    elapsed_ms = int((time.time() - start_t) * 1000)
                    db.add(AIUsageLog(feature=module, model_used=current_model, prompt_tokens=pt, completion_tokens=ct, response_time_ms=elapsed_ms))
                    await db.commit()
            except Exception as e:
                logger.error("Failed to log AI usage: %s", e)

            return response

        except Exception as e:
            logger.error(f"Groq API error on model {current_model}: {e}")
            _dynamic_model = None  # Reset so it picks a different one next time or falls back
            if attempt == 2:
                # If we exhausted attempts, return fallback
                return _get_fallback_response(module, user_message)


async def generate_json_response(
    module: str,
    user_message: str,
    context: str = "",
    max_tokens: int = 1024,
) -> dict:
    """
    Generate an AI response strictly formatted as a JSON object.
    """
    import json
    client = _get_groq_client()

    if client is None:
        logger.warning("Groq client not available for JSON extraction.")
        return {}

    system_prompt = SYSTEM_PROMPTS.get(module, SYSTEM_PROMPTS.get("assistant", ""))
    
    # Attempt to fetch from DB
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AIPrompt).where(AIPrompt.module == module, AIPrompt.is_active == True))
            prompt_obj = result.scalar_one_or_none()
            if prompt_obj and prompt_obj.content:
                system_prompt = prompt_obj.content
    except Exception as e:
        logger.error("Failed to fetch JSON prompt from DB: %s", e)

    if context:
        system_prompt += f"\n\nContext:\n{context}"

    global _dynamic_model

    for attempt in range(3):
        current_model = await _get_best_model(client)
        try:
            start_t = time.time()
            chat_completion = await client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                model=current_model,
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            response_text = chat_completion.choices[0].message.content
            
            # Log AI Usage
            try:
                async with AsyncSessionLocal() as db:
                    pt = chat_completion.usage.prompt_tokens if hasattr(chat_completion, 'usage') and chat_completion.usage else 0
                    ct = chat_completion.usage.completion_tokens if hasattr(chat_completion, 'usage') and chat_completion.usage else 0
                    elapsed_ms = int((time.time() - start_t) * 1000)
                    db.add(AIUsageLog(feature=module, model_used=current_model, prompt_tokens=pt, completion_tokens=ct, response_time_ms=elapsed_ms))
                    await db.commit()
            except Exception as e:
                logger.error("Failed to log AI usage: %s", e)

            return json.loads(response_text)

        except Exception as e:
            logger.error(f"Groq JSON API error on model {current_model}: {e}")
            _dynamic_model = None  # Reset so it picks a different one next time or falls back
            if attempt == 2:
                # If we exhausted attempts, return error json
                return {"_error": str(e)}



# ─── Fallback Responses ─────────────────────────────────────────────

def _get_fallback_response(module: str, message: str) -> str:
    """Provide local fallback responses when Groq API is unavailable."""
    q = message.lower()

    if module == "assistant":
        return _fallback_assistant(q)
    elif module == "symptom":
        return '{"urgency":"Medium","conditions":[{"condition":"Please consult a doctor for accurate diagnosis","probability":0}],"specialists":["General Physician"],"recommendations":["Stay hydrated","Rest well","Monitor your symptoms","Consult a healthcare professional"]}'
    elif module == "nutrition":
        return "Based on your profile, aim for a balanced diet with adequate protein, complex carbs, and healthy fats. Drink plenty of water and eat 5 servings of fruits and vegetables daily. Consult a nutritionist for a personalized meal plan."
    elif module == "fitness":
        return "For a balanced fitness routine, aim for 150 minutes of moderate cardio per week, 2-3 strength training sessions, and daily stretching. Start slow and gradually increase intensity. Always warm up before exercise and cool down after."
    elif module == "mental":
        return "Thank you for sharing. Remember that it's completely normal to have ups and downs. Practice self-care, maintain social connections, and consider journaling regularly. If you're struggling, please reach out to a mental health professional. Helpline: 9152987821 (iCall)."

    return "I'm here to help with your health questions. Please try again or consult a healthcare professional for specific medical advice."


def _fallback_assistant(q: str) -> str:
    """Keyword-based fallback for the chat assistant."""
    if any(w in q for w in ["paracetamol", "acetaminophen"]):
        return "Paracetamol (Acetaminophen) is used for pain relief and fever reduction. Usual adult dose: 500mg-1g every 4-6 hours. Max: 4g/day. Avoid with alcohol."
    if any(w in q for w in ["headache", "head pain"]):
        return "Headache Management:\n• Stay hydrated\n• Rest in a dark, quiet room\n• Take paracetamol or ibuprofen\n• Apply cold compress\n\n⚠️ See a doctor if severe, sudden, or with fever/vision changes."
    if any(w in q for w in ["fever", "temperature"]):
        return "Fever Management:\n• Rest and stay hydrated\n• Take paracetamol or ibuprofen\n• Use lukewarm sponge bath\n• Wear light clothing\n\n⚠️ Seek help if >103°F or lasting >3 days."
    if any(w in q for w in ["burn", "burnt"]):
        return "Burns First Aid:\n1. Cool under running water for 20 min\n2. Remove jewelry (if not stuck)\n3. Cover with sterile dressing\n4. Do NOT apply ice/butter/toothpaste\n5. Take paracetamol for pain"
    if any(w in q for w in ["hello", "hi ", "hey"]):
        return "Hello! I'm your LifeOS AI Health Assistant. How can I help you today? Ask me about medicines, first aid, or health concerns."
    if "tip" in q or "advice" in q:
        return "💡 Health Tip: Drink at least 8 glasses of water daily, take a 30-minute walk, get 7-9 hours of sleep, and eat 5 servings of fruits and vegetables daily."

    # Truncate q to avoid dumping massive prompts to the UI
    truncated_q = q[:50] + "..." if len(q) > 50 else q
    return f'I understand you\'re asking about "{truncated_q}". For the most accurate information, please consult a healthcare professional. I can help with medicine info, first aid guidance, and general health tips.'
