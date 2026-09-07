import os
import json
import logging
import base64
import uuid
import time
import re
import aiofiles
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI

from app.dependencies import CurrentUserId
from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.models.admin import AIUsageLog
from app.models.file_asset import FileAsset

logger = logging.getLogger("lifeos.vision")

router = APIRouter(prefix="/vision", tags=["Vision AI"])
settings = get_settings()


class VisionRequest(BaseModel):
    image_data: str  # Base64 string starting with data:image/...
    scan_type: str   # 'food' or 'pill'


def extract_and_parse_json(text: str) -> dict:
    """Safely extracts JSON from model response even if wrapped in markdown blocks."""
    text = text.strip()
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1).strip()
    else:
        match2 = re.search(r'\{.*\}', text, re.DOTALL)
        if match2:
            text = match2.group(0).strip()
    return json.loads(text)


async def get_supported_gemini_models(api_key: str) -> list[str]:
    """Query Google API to discover exact model names supported by this API key."""
    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }
    endpoints = [
        f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
        f"https://generativelanguage.googleapis.com/v1/models?key={api_key}"
    ]

    found = []
    async with httpx.AsyncClient() as http_client:
        for url in endpoints:
            try:
                res = await http_client.get(url, headers=headers, timeout=10.0)
                if res.status_code == 200:
                    data = res.json()
                    for item in data.get("models", []):
                        methods = item.get("supportedGenerationMethods", [])
                        if "generateContent" in methods:
                            m_name = item.get("name", "").replace("models/", "").strip()
                            if m_name and m_name not in found:
                                found.append(m_name)
                    if found:
                        break
            except Exception as e:
                logger.warning(f"Error querying Gemini models list at {url}: {e}")

    # Prioritize: Flash models first (fastest for vision), then newest version numbers
    def model_priority(name: str) -> int:
        lower = name.lower()
        score = 0
        if "flash" in lower:
            score += 100
        if "2.5" in lower or "3." in lower:
            score += 30
        elif "2.0" in lower or "2-" in lower:
            score += 20
        elif "1.5" in lower:
            score += 10
        if "lite" in lower:
            score -= 5
        if "exp" in lower or "preview" in lower:
            score -= 10
        return score

    found.sort(key=model_priority, reverse=True)
    return found


async def analyze_with_openai(prompt: str, mime_type: str, base64_img: str, api_key: str, model: str = "gpt-4o-mini") -> tuple[dict, int, int, int]:
    """Analyze image using OpenAI Vision API (gpt-4o-mini / gpt-4o)."""
    start_t = time.time()
    client = AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. No markdown fences, no conversational text."},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_img}"}}
                    ]
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            timeout=40.0
        )
        elapsed_ms = int((time.time() - start_t) * 1000)
        content = response.choices[0].message.content or "{}"
        p_tokens = response.usage.prompt_tokens if response.usage else 0
        c_tokens = response.usage.completion_tokens if response.usage else 0
        parsed = extract_and_parse_json(content)
        return parsed, p_tokens, c_tokens, elapsed_ms
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OpenAI Vision API error: {e}")
        raise HTTPException(status_code=500, detail=f"OpenAI Vision Error: {str(e)}")


async def analyze_with_gemini(prompt: str, mime_type: str, base64_img: str, api_key: str, model: str = "") -> tuple[dict, int, int, int, str]:
    """Analyze image using Google Gemini Vision API (free tier)."""
    start_t = time.time()

    # 1. Dynamically discover models supported by this specific API key
    discovered_models = await get_supported_gemini_models(api_key)

    # 2. Build prioritized models list
    models_to_try = []
    if model and model in discovered_models:
        models_to_try.append(model)
    for m in discovered_models:
        if m not in models_to_try:
            models_to_try.append(m)

    # 3. Fallback defaults if discovery could not reach models endpoint
    if not models_to_try:
        models_to_try = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
            "gemini-2.0-flash-exp",
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ]

    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt + "\n\nIMPORTANT: Respond with pure valid JSON only."},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_img
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    last_err = "No response from Gemini"

    async with httpx.AsyncClient() as http_client:
        for m in models_to_try:
            for api_version in ["v1beta", "v1"]:
                gemini_url = f"https://generativelanguage.googleapis.com/{api_version}/models/{m}:generateContent?key={api_key}"
                try:
                    response = await http_client.post(gemini_url, json=payload, headers=headers, timeout=35.0)
                    if response.status_code == 200:
                        resp_data = response.json()
                        text_content = resp_data["candidates"][0]["content"]["parts"][0]["text"]
                        elapsed_ms = int((time.time() - start_t) * 1000)
                        parsed = extract_and_parse_json(text_content)
                        return parsed, 0, 0, elapsed_ms, m
                    elif response.status_code == 404:
                        last_err = f"{response.status_code} - {response.text}"
                        continue
                    else:
                        last_err = f"{response.status_code} - {response.text}"
                        continue
                except Exception as e:
                    last_err = str(e)
                    continue

    logger.error(f"Gemini Vision API error: {last_err}")
    raise HTTPException(status_code=500, detail=f"Gemini Vision Error: {last_err}")


@router.get("/test_gemini")
async def test_gemini():
    """Test Gemini API key and list available models."""
    gemini_key = (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")).strip()
    if not gemini_key:
        return {"error": "GEMINI_API_KEY is not set in backend/.env"}
    models = await get_supported_gemini_models(gemini_key)
    return {
        "status": "success" if models else "failed",
        "key_prefix": gemini_key[:8] + "...",
        "available_models_count": len(models),
        "available_models": models
    }


@router.get("/providers")
async def get_providers_status():
    """Return status of configured Vision AI providers."""
    openai_key = (settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")).strip()
    gemini_key = (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")).strip()

    is_openai_gsk = openai_key.startswith("gsk_")
    is_valid_openai = bool(openai_key and not is_openai_gsk and len(openai_key) > 20)
    is_valid_gemini = bool(gemini_key and len(gemini_key) > 10)

    return {
        "openai": {
            "configured": is_valid_openai,
            "model": settings.OPENAI_VISION_MODEL or "gpt-4o-mini",
            "warning": "Key starts with 'gsk_' (Groq key), please replace with OpenAI 'sk-' key." if is_openai_gsk else None
        },
        "gemini": {
            "configured": is_valid_gemini,
            "model": settings.GEMINI_MODEL or "gemini-1.5-flash",
            "is_free": True
        }
    }


@router.post("/analyze")
async def analyze_image(request: VisionRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Analyze an image using OpenAI (gpt-4o-mini) or Google Gemini Flash Vision and save as FileAsset."""
    try:
        # 1. Extract base64 part if it contains the data:image/... prefix
        base64_img = request.image_data
        mime_type = "image/jpeg"
        ext = "jpg"

        if base64_img.startswith("data:image/png"):
            mime_type = "image/png"
            ext = "png"
        elif base64_img.startswith("data:image/webp"):
            mime_type = "image/webp"
            ext = "webp"

        if "," in base64_img:
            base64_img = base64_img.split(",", 1)[1]

        # 2. Save image to disk and create FileAsset
        img_bytes = base64.b64decode(base64_img)
        os.makedirs("uploads/images", exist_ok=True)
        filename = f"vision_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = f"uploads/images/{filename}"

        async with aiofiles.open(filepath, "wb") as f:
            await f.write(img_bytes)

        file_size = os.path.getsize(filepath)
        new_asset = FileAsset(
            name=f"Vision Scan - {request.scan_type.capitalize()}",
            type=mime_type,
            category="Images",
            size_bytes=file_size,
            file_path=f"/{filepath}"
        )
        db.add(new_asset)
        await db.commit()

        # 3. Formulate analysis prompt based on scan type
        if request.scan_type == "food":
            prompt = """
Analyze this image of food/meal. Estimate the nutritional content.
Return ONLY a valid JSON object in the following format:
{
  "name": "Name of the dish/meal",
  "calories": <integer>,
  "protein": <integer (grams)>,
  "carbs": <integer (grams)>,
  "fats": <integer (grams)>,
  "sodium": <integer (mg)>
}
Do not include markdown blocks or any other text.
"""
        elif request.scan_type == "pill":
            prompt = """
Identify this pill/medication from the image.
Return ONLY a valid JSON object in the following format:
{
  "name": "Name of medication",
  "purpose": "Brief description of what it's used for",
  "common_interactions": ["List", "of", "common", "interactions", "or", "warnings"]
}
Do not include markdown blocks or any other text.
"""
        else:
            raise HTTPException(status_code=400, detail="Invalid scan_type. Must be 'food' or 'pill'.")

        # 4. Determine AI Provider (OpenAI prioritized, Gemini fallback / free tier)
        openai_key = (settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")).strip()
        gemini_key = (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")).strip()

        is_openai_gsk = openai_key.startswith("gsk_")
        is_valid_openai = bool(openai_key and not is_openai_gsk and len(openai_key) > 20)
        is_valid_gemini = bool(gemini_key and len(gemini_key) > 10)

        if is_valid_openai:
            model_name = settings.OPENAI_VISION_MODEL or "gpt-4o-mini"
            parsed, p_tokens, c_tokens, elapsed_ms = await analyze_with_openai(
                prompt=prompt,
                mime_type=mime_type,
                base64_img=base64_img,
                api_key=openai_key,
                model=model_name
            )
            provider_used = f"openai-{model_name}"

        elif is_valid_gemini:
            parsed, p_tokens, c_tokens, elapsed_ms, model_used = await analyze_with_gemini(
                prompt=prompt,
                mime_type=mime_type,
                base64_img=base64_img,
                api_key=gemini_key,
                model=settings.GEMINI_MODEL or ""
            )
            provider_used = f"gemini-{model_used}"

        else:
            if is_openai_gsk:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "OpenAI Vision requires a valid OpenAI API key (starting with 'sk-'). "
                        "The key currently in backend/.env is a Groq key (starts with 'gsk_'). "
                        "Please set OPENAI_API_KEY=sk-... in backend/.env, or get a 100% FREE Gemini key "
                        "from https://aistudio.google.com and set GEMINI_API_KEY=... in backend/.env."
                    )
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No Vision AI provider configured. "
                        "Please add OPENAI_API_KEY=sk-... or a free GEMINI_API_KEY=... to your backend/.env file."
                    )
                )

        # 5. Log AI Usage
        try:
            async with AsyncSessionLocal() as db_session:
                db_session.add(AIUsageLog(
                    feature=f"scan_{request.scan_type}",
                    model_used=provider_used,
                    prompt_tokens=p_tokens,
                    completion_tokens=c_tokens,
                    response_time_ms=elapsed_ms
                ))
                await db_session.commit()
        except Exception as log_e:
            logger.error("Failed to log vision AI usage: %s", log_e)

        # 6. Post-process ScannedMeal if food scan
        if request.scan_type == "food":
            from app.models.diet import ScannedMeal
            new_meal = ScannedMeal(
                user_id=user_id,
                name=parsed.get("name", "Unknown Meal"),
                calories=parsed.get("calories", 0),
                protein=parsed.get("protein", 0),
                carbs=parsed.get("carbs", 0),
                fats=parsed.get("fats", 0),
                image_url=f"/{filepath}"
            )
            db.add(new_meal)
            await db.commit()
            parsed["image_url"] = f"/{filepath}"

        return {"success": True, "data": parsed}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in Vision API: {e}")
        raise HTTPException(status_code=500, detail=str(e))
