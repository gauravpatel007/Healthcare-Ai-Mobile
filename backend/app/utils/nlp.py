import os
import json
import logging
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(override=True)
logger = logging.getLogger(__name__)

# Fetch available models on load
try:
    import urllib.request
    _api_key = os.environ.get("GROQ_API_KEY")
    if _api_key:
        _req = urllib.request.Request("https://api.groq.com/openai/v1/models")
        _req.add_header("Authorization", f"Bearer {_api_key}")
        _res = urllib.request.urlopen(_req)
        with open("g:/Languages/Projects/Healthcare AI/R1/backend/groq_models.json", "w") as f:
            f.write(_res.read().decode("utf-8"))
except Exception as e:
    logger.error(f"Failed to fetch models: {e}")

logger = logging.getLogger(__name__)

# Initialize AsyncOpenAI client pointing to Groq for ultra-fast NLP
client = AsyncOpenAI(
    api_key=os.environ.get("GROQ_API_KEY", os.environ.get("OPENAI_API_KEY", "dummy")),
    base_url="https://api.groq.com/openai/v1"
)

async def parse_voice_command(text: str) -> dict:
    """
    Parses a natural language voice command.
    Detects health logging, UI navigation, form filling, feature triggers, and more.
    """
    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set. Cannot parse voice command.")
        return {"type": "unknown", "value": 0, "unit": ""}

    prompt = f"""
    You are an intelligent health app voice assistant. Parse the user's spoken command.
    IMPORTANT: The user input comes from speech-to-text. Auto-correct any obvious phonetical typos (e.g. "I slap 7 hours" -> "I slept 7 hours", "wait is 70" -> "weight is 70", "log in out" -> "log out").
    
    CATEGORY A — HEALTH DATA LOG (user wants to record a metric):
      Types: 'sleep' (hours), 'weight' (kg), 'blood_pressure' (mmHg), 'heart_rate' (bpm)
      Return: {{ "type": "<sleep|weight|blood_pressure|heart_rate>", "value": <number>, "secondary_value": <number>, "unit": "<string>" }}
      Examples:
      - "I slept 7 hours" or "I slap 7 hours" → {{ "type": "sleep", "value": 7.0, "unit": "hours" }}
      - "my weight is 70 kg" → {{ "type": "weight", "value": 70.0, "unit": "kg" }}
      - "my blood pressure is 120 over 80" → {{ "type": "blood_pressure", "value": 120.0, "secondary_value": 80.0, "unit": "mmHg" }}
      - "my blood pressure is 80" → {{ "type": "blood_pressure", "value": 80.0, "secondary_value": 80.0, "unit": "mmHg" }}
      - "my pulse is 75" or "my heart rate is 75" → {{ "type": "heart_rate", "value": 75.0, "unit": "bpm" }}

    CATEGORY B — UI ACTION (navigate, open modals, trigger features):
      Return: {{ "type": "action", "target_feature": "<id>", "action_name": "<action>", "data": {{...}} }}
      
      Feature IDs and actions:
      - "appointments": open_page, open_add_modal, fill_form
      - "medicine": open_page, open_add_modal, fill_form
      - "records": open_page, open_add_modal, compare_reports, ai_summary
      - "emergency": open_page, trigger_sos
      - "dashboard": open_page
      - "ai-chat": open_page, send_message, open_history, open_daily_tips, new_chat, like_last_message, dislike_last_message, copy_last_message
      - "ai-symptom": open_page, check_symptoms
      - "ai-nutrition": open_page, regenerate_plan, open_scan_meal, mark_meal_eaten
      - "ai-fitness": open_page, add_steps, remove_steps, log_exercise, regenerate_plan
      - "ai-mental": open_page, start_meditation
      - "trackers": open_page, open_tab
      - "settings": open_page
      - "analytics": open_page
      - "auth": logout

      NAVIGATION & MODALS:
      - "go to medicine", "open medicine", "show medicines" → {{ "type": "action", "target_feature": "medicine", "action_name": "open_page" }}
      - "add medicine", "new medicine" → {{ "type": "action", "target_feature": "medicine", "action_name": "open_add_modal" }}
      - "add appointment", "book appointment" → {{ "type": "action", "target_feature": "appointments", "action_name": "open_add_modal" }}
      - "add record", "upload report" → {{ "type": "action", "target_feature": "records", "action_name": "open_add_modal" }}
      - "dashboard": open_page
      DASHBOARD ACTIONS — "share doctor summary":
      {{ "type": "action", "target_feature": "dashboard", "action_name": "share_doctor_summary" }}
      
      AI CHAT ACTIONS — "History", "Daily Tips", "New Chat":
      {{ "type": "action", "target_feature": "ai-chat", "action_name": "open_history" }}
      {{ "type": "action", "target_feature": "ai-chat", "action_name": "open_daily_tips" }}
      {{ "type": "action", "target_feature": "ai-chat", "action_name": "new_chat" }}
      {{ "type": "action", "target_feature": "ai-chat", "action_name": "like_last_message" }}
      {{ "type": "action", "target_feature": "ai-chat", "action_name": "dislike_last_message" }}
      {{ "type": "action", "target_feature": "ai-chat", "action_name": "copy_last_message" }}

      APPOINTMENT FORM FILLING — "book appointment with Dr. Sharma tomorrow at 12pm":
      {{ "type": "action", "target_feature": "appointments", "action_name": "fill_form", "data": {{ "time": "12:00", "doctor": "Dr. Sharma", "date": "2026-07-25", "specialty": "...", "hospital": "...", "notes": "..." }} }}
      Only include fields the user actually mentioned. Omit fields not mentioned.
      - "show blood pressure of past 6 months" → {{ "type": "action", "target_feature": "dashboard", "action_name": "change_param_view", "data": {{ "param": "bp", "timeframe": "6months" }} }}
      - "show weight of past 3 months" → {{ "type": "action", "target_feature": "dashboard", "action_name": "change_param_view", "data": {{ "param": "weight", "timeframe": "3months" }} }}
      - "show pulse of this month" → {{ "type": "action", "target_feature": "dashboard", "action_name": "change_param_view", "data": {{ "param": "pulse", "timeframe": "thisMonth" }} }}
      - "ai-chat": open_page, send_message
      - "ai-symptom": open_page, check_symptoms
      - "ai-nutrition": open_page, regenerate_plan, open_scan_meal, mark_meal_eaten
      - "ai-fitness": open_page, add_steps, remove_steps, log_exercise, regenerate_plan
      - "ai-mental": open_page, start_meditation
      - "trackers": open_page
      - "settings": open_page
      - "analytics": open_page
      - "auth": logout

      INNER TABS NAVIGATION:
      - "go to gamification", "open gamification" → {{ "type": "action", "target_feature": "trackers", "action_name": "open_tab", "data": {{ "tab": "gamification" }} }}
      - "go to sleep tab", "open sleep" → {{ "type": "action", "target_feature": "trackers", "action_name": "open_tab", "data": {{ "tab": "sleep" }} }}
      - "go to bmi", "open bmi" → {{ "type": "action", "target_feature": "trackers", "action_name": "open_tab", "data": {{ "tab": "bmi" }} }}
      - "go to wearables", "open wearable" → {{ "type": "action", "target_feature": "trackers", "action_name": "open_tab", "data": {{ "tab": "wearable" }} }}

      - "open vitals", "go to health vitals" → {{ "type": "action", "target_feature": "analytics", "action_name": "open_tab", "data": {{ "tab": "vitals" }} }}
      - "open adherence", "medicine adherence" → {{ "type": "action", "target_feature": "analytics", "action_name": "open_tab", "data": {{ "tab": "adherence" }} }}
      - "open risk score", "health risk score" → {{ "type": "action", "target_feature": "analytics", "action_name": "open_tab", "data": {{ "tab": "risk" }} }}
      - "open activity records" → {{ "type": "action", "target_feature": "analytics", "action_name": "open_tab", "data": {{ "tab": "activity" }} }}
      - "open lab trends" → {{ "type": "action", "target_feature": "analytics", "action_name": "open_tab", "data": {{ "tab": "lab_trends" }} }}

      - "open profile settings" → {{ "type": "action", "target_feature": "settings", "action_name": "open_tab", "data": {{ "tab": "profile" }} }}
      - "open security settings" → {{ "type": "action", "target_feature": "settings", "action_name": "open_tab", "data": {{ "tab": "security" }} }}
      - "open advanced settings" → {{ "type": "action", "target_feature": "settings", "action_name": "open_tab", "data": {{ "tab": "advanced" }} }}
      - "open notification settings" → {{ "type": "action", "target_feature": "settings", "action_name": "open_tab", "data": {{ "tab": "notifications" }} }}

      - "open blood tests", "blood test list", "all blood test reports" → {{ "type": "action", "target_feature": "records", "action_name": "open_tab", "data": {{ "tab": "Blood Test" }} }}
      - "open imaging reports" → {{ "type": "action", "target_feature": "records", "action_name": "open_tab", "data": {{ "tab": "Imaging" }} }}
      - "open prescriptions" → {{ "type": "action", "target_feature": "records", "action_name": "open_tab", "data": {{ "tab": "Prescription" }} }}
      APPOINTMENTS:
      - "AI prep for Dr. Smith", "AI preparation for Dr. Smith appointment" → {{ "type": "action", "target_feature": "appointments", "action_name": "ai_prep", "data": {{ "doctor": "Dr. Smith" }} }}
      - "schedule an appointment" → {{ "type": "action", "target_feature": "appointments", "action_name": "open_add_modal" }}

      APPOINTMENT FORM FILLING — "set doctor to Dr. Sharma":
      {{ "type": "action", "target_feature": "appointments", "action_name": "fill_form", "data": {{ "time": "12:00", "doctor": "Dr. Sharma", "date": "2026-07-25", "specialty": "...", "hospital": "...", "notes": "..." }} }}
      Only include fields the user actually mentioned. Omit fields not mentioned.

      MEDICINE FORM FILLING — "set medicine name to Paracetamol, dosage 500mg":
      {{ "type": "action", "target_feature": "medicine", "action_name": "fill_form", "data": {{ "name": "Paracetamol", "dosage": "500mg", "type": "tablet", "frequency": "once_daily", "purpose": "..." }} }}

      COMPARE REPORTS:
      - "compare reports" → {{ "type": "action", "target_feature": "records", "action_name": "compare_reports" }}
      
      AI SUMMARY FOR RECORD:
      - "find AI summary for blood test" → {{ "type": "action", "target_feature": "records", "action_name": "ai_summary", "data": {{ "record_name": "blood test" }} }}

      AI CHAT — send message directly:
      - Any command after "Hey AI" wake word → {{ "type": "action", "target_feature": "ai-chat", "action_name": "send_message", "data": {{ "message": "<the user's question>" }} }}

      SYMPTOM CHECKER:
      - "check symptoms for headache and fever" → {{ "type": "action", "target_feature": "ai-symptom", "action_name": "check_symptoms", "data": {{ "symptoms": ["headache", "fever"], "duration": "1-3 days", "severity": "Moderate", "age_group": "Adult (18-60)" }} }}
      If user specifies duration, severity, age_group, include them. Otherwise use defaults above.

      FIRST AID & TRIAGE (VOICE RESPONSES):
      - "how do I perform CPR", "I burnt my hand" → {{ "type": "action", "target_feature": "jarvis_ai", "action_name": "first_aid", "data": {{ "query": "how do I perform CPR" }} }}
      - "I have a severe headache and blurry vision" → {{ "type": "action", "target_feature": "jarvis_ai", "action_name": "triage", "data": {{ "symptoms": "severe headache and blurry vision" }} }}
      
      NUTRITION:
      - "regenerate my meal" → {{ "type": "action", "target_feature": "ai-nutrition", "action_name": "regenerate_plan" }}
      - "I had an apple and a sandwich" → {{ "type": "nutrition_log", "food": "apple and sandwich" }}

      MEDICINE:
      - "I took paracetamol" → {{ "type": "medicine_log", "name": "paracetamol" }}
      - "edit medicine Dolo", "update paracetamol" → {{ "type": "action", "target_feature": "medicine", "action_name": "edit_medicine", "data": {{ "name": "Dolo" }} }}
      - "check interactions", "do my medicines interact?" → {{ "type": "action", "target_feature": "medicine", "action_name": "check_interactions" }}
      - Note: User must say the exact medicine name. If they say "morning pills", log the name as "morning pills" but try to encourage exact names.

      FITNESS:
      - "add 2000 steps" → {{ "type": "action", "target_feature": "ai-fitness", "action_name": "add_steps", "data": {{ "steps": 2000 }} }}
      - "minus 2000 steps" or "remove 2000 steps" → {{ "type": "action", "target_feature": "ai-fitness", "action_name": "remove_steps", "data": {{ "steps": 2000 }} }}
      - "regenerate my workout plan" → {{ "type": "action", "target_feature": "ai-fitness", "action_name": "regenerate_plan" }}
      - "I did brisk walking" or "log brisk walking" → {{ "type": "action", "target_feature": "ai-fitness", "action_name": "log_exercise", "data": {{ "exercise": "Brisk Walking", "calories": 150 }} }}
      Use reasonable calorie estimates: Brisk Walking=150, Running=300, Cycling=250, Yoga=120, Swimming=400, Jump Rope=350.

      NUTRITION:
      - "open scan meal", "scan my meal" → {{ "type": "action", "target_feature": "ai-nutrition", "action_name": "open_scan_meal" }}
      - "regenerate my meal plan" → {{ "type": "action", "target_feature": "ai-nutrition", "action_name": "regenerate_plan" }}
      - "I ate Sprouts Salad", "mark Sprouts Salad as eaten", "I eat oatmeal with fruits" → {{ "type": "action", "target_feature": "ai-nutrition", "action_name": "mark_meal_eaten", "data": {{ "meal": "Sprouts Salad" }} }}
      - "I had an apple and a sandwich" → {{ "type": "nutrition_log", "food": "apple and sandwich" }}
      NOTE: If the user mentions eating a dish that sounds like a meal plan item (e.g., "Oatmeal with fruits", "Sprouts Salad", "Dal Rice"), ALWAYS use the `mark_meal_eaten` action so it can be ticked off in the UI! Use `nutrition_log` ONLY for generic loose items (e.g., "an apple").

      MENTAL HEALTH:
      - "start deep breathing" → {{ "type": "action", "target_feature": "ai-mental", "action_name": "start_meditation", "data": {{ "meditation": "Deep Breathing" }} }}
      - "start body scan" → {{ "type": "action", "target_feature": "ai-mental", "action_name": "start_meditation", "data": {{ "meditation": "Body Scan" }} }}
      - "today mood is great", "mood is low" → {{ "type": "action", "target_feature": "ai-mental", "action_name": "log_mood", "data": {{ "mood": "Great" }} }}
        (Valid moods: Great, Good, Okay, Low, Sad, Angry, Anxious)

      EMERGENCY:
      - "call SOS" / "trigger SOS" → {{ "type": "action", "target_feature": "emergency", "action_name": "trigger_sos" }}
      - "code red" / "silent emergency" → {{ "type": "action", "target_feature": "emergency", "action_name": "trigger_sos_silent" }}

      LOGOUT / ADD ACCOUNT / SWITCH ACCOUNT:
      - "log out" / "logout" / "sign out" → {{ "type": "action", "target_feature": "auth", "action_name": "logout" }}
      - "add new account" / "add account" → {{ "type": "action", "target_feature": "auth", "action_name": "add_account" }}
      - "switch account" → {{ "type": "action", "target_feature": "auth", "action_name": "switch_account_next" }}
      - "switch account to test@example.com" → {{ "type": "action", "target_feature": "auth", "action_name": "switch_account_specific", "data": {{ "email": "test@example.com" }} }}

    CATEGORY C — UNKNOWN:
      {{ "type": "unknown", "value": 0, "unit": "" }}

    User Command: "{text}"
    
    IMPORTANT: You must parse the command and return a strict JSON object with a single key "actions" containing a list of action objects.
    This allows detecting multiple commands in a single sentence (e.g. "I slept 8 hours and took paracetamol").
    Example output format:
    {{
      "actions": [
         {{ "type": "sleep", "value": 8, "unit": "hours" }},
         {{ "type": "medicine_log", "name": "paracetamol" }}
      ]
    }}
    
    If it's just one command, still wrap it in the actions array:
    {{
      "actions": [
         {{ "type": "weight", "value": 70.0, "unit": "kg" }}
      ]
    }}
    
    Return ONLY a strict JSON object. No explanation.
    """
    try:
        response = await client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that always outputs valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        result_text = response.choices[0].message.content
        return json.loads(result_text)
    except Exception as e:
        error_str = str(e).lower()
        if "400" in error_str or "404" in error_str or "decommissioned" in error_str or "not exist" in error_str or "not found" in error_str:
            logger.warning(f"Primary model failed, attempting direct fallback. Original error: {e}")
            try:
                # Direct fallback to a stable text model without making an HTTP request to fetch models
                fallback_model = "openai/gpt-oss-120b"
                logger.info(f"Trying auto-fallback model: {fallback_model}")
                response = await client.chat.completions.create(
                    model=fallback_model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that always outputs valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0
                )
                result_text = response.choices[0].message.content
                logger.info(f"Successfully parsed with {fallback_model}")
                return json.loads(result_text)
            except Exception as fallback_e:
                logger.error(f"Auto-fallback completely failed: {fallback_e}")
                return {"type": "unknown", "value": 0, "unit": "", "error": f"Fallback Error: {fallback_e} | Original: {e}"}
                
        logger.error(f"Failed to parse voice command: {e}")
        return {"type": "unknown", "value": 0, "unit": "", "error": str(e)}
