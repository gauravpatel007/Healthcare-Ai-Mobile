import os
import json
import base64
import httpx
from typing import Dict, Any, List
import logging

# We will try to import fitz for PDF parsing. If it's missing, we log an error.
try:
    import fitz
except ImportError:
    fitz = None

logger = logging.getLogger(__name__)

from app.config import get_settings
settings = get_settings()

class DocumentAIService:
    def __init__(self):
        self.api_key = os.environ.get("GROQ_API_KEY")
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.text_model = "openai/gpt-oss-120b"
        self.vision_model = "qwen/qwen3.6-27b"
        self._models_resolved = False

    async def _resolve_models(self):
        if self._models_resolved:
            return
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                if resp.status_code == 200:
                    models = resp.json().get("data", [])
                    model_ids = [m["id"] for m in models]
                    
                    # Resolve text model
                    resolved_text = None
                    for m_id in model_ids:
                        if "llama-3" in m_id.lower() and "70b" in m_id.lower() and "vision" not in m_id.lower():
                            resolved_text = m_id
                            break
                    if not resolved_text:
                        for m_id in model_ids:
                            if "llama-3" in m_id.lower() and "vision" not in m_id.lower():
                                resolved_text = m_id
                                break
                    if not resolved_text:
                        for m_id in model_ids:
                            if "gemma2" in m_id.lower():
                                resolved_text = m_id
                                break
                    if resolved_text:
                        self.text_model = resolved_text
                        
                    # Resolve vision model
                    resolved_vision = None
                    for m_id in model_ids:
                        if "vision" in m_id.lower():
                            resolved_vision = m_id
                            break
                    if resolved_vision:
                        self.vision_model = resolved_vision
        except Exception as e:
            logger.warning(f"Failed to fetch dynamic models for document service: {e}")
            
        self._models_resolved = True

    async def analyze_document(self, file_path: str, record_info: str = "") -> Dict[str, Any]:
        """
        Analyzes a medical document (PDF or Image) and returns a JSON payload containing:
        - summary: A detailed markdown summary of the document.
        - metrics: A list of dicts with keys (metric_name, value, unit, reference_range, status)
        """
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not set in the environment.")
            
        await self._resolve_models()
            
        ext = os.path.splitext(file_path)[1].lower() if file_path else ""
        
        try:
            if not file_path:
                # If no file, analyze just based on record_info (for seed data)
                return await self._analyze_text_only(record_info)
            elif ext == '.pdf':
                return await self._analyze_pdf(file_path, record_info)
            elif ext in ['.png', '.jpg', '.jpeg', '.webp']:
                return await self._analyze_image(file_path, record_info)
            else:
                raise ValueError(f"Unsupported file type: {ext}. Only PDF and images are supported.")
        except Exception as e:
            logger.error(f"Error analyzing document: {str(e)}")
            raise

    async def _analyze_text_only(self, record_info: str) -> Dict[str, Any]:
        prompt = self._get_analysis_prompt(record_info)
        payload = {
            "model": self.text_model,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": "Please generate the summary and extract metrics based on the provided record metadata."}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        return await self._call_groq(payload, parse_json=True)

    async def _analyze_pdf(self, file_path: str, record_info: str) -> Dict[str, Any]:
        if not fitz:
            raise ImportError("PyMuPDF (fitz) is not installed. Cannot process PDF.")
            
        text = ""
        try:
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text()
            doc.close()
        except Exception as e:
            raise Exception(f"Failed to read PDF: {str(e)}")
            
        if not text.strip():
            # If empty, just use the metadata
            return await self._analyze_text_only(record_info)
            
        prompt = self._get_analysis_prompt(record_info)
        
        payload = {
            "model": self.text_model,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Here is the medical report text:\n\n{text}"}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        
        return await self._call_groq(payload, parse_json=True)

    async def _analyze_image(self, file_path: str, record_info: str) -> Dict[str, Any]:
        try:
            with open(file_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            raise Exception(f"Failed to read image: {str(e)}")
            
        ext = os.path.splitext(file_path)[1].lower().replace('.', '')
        if ext == 'jpg':
            ext = 'jpeg'
            
        image_url = f"data:image/{ext};base64,{encoded_string}"
        
        prompt = self._get_analysis_prompt(record_info)
        
        payload = {
            "model": self.vision_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"{prompt}\n\nPlease analyze the attached medical report image and return ONLY a JSON object." },
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            "temperature": 0.1
        }
        
        return await self._call_groq(payload, parse_json=True)

    def _get_analysis_prompt(self, record_info: str = "") -> str:
        prompt = """
        You are an expert AI medical assistant. Your task is to extract structured data from a medical lab report and generate a comprehensive summary.
        
        Analyze the provided report (and/or record metadata) and return a JSON object with EXACTLY the following structure:
        {
          "summary": "A detailed, professionally formatted Markdown summary of the medical record. Use headings (e.g., **Patient Information**, **Test Results**, **Key Findings**, **Recommendations**), bullet points, and tables where appropriate. Highlight abnormal values using 🔴 (Low/High/High Risk), 🟠 (Moderate), 🟡 (Slightly Abnormal), and ✅ (Normal). DO NOT return plain text paragraphs. Make it look beautiful and easy to read.",
          "metrics": [
            {
              "metric_name": "Name of the test (e.g. Hemoglobin, Vitamin D)",
              "value": "The measured value as a string (e.g. 14.5, <0.5)",
              "unit": "The unit of measurement (e.g. g/dL, ng/mL)",
              "reference_range": "The normal reference range as a string (e.g. 13.0-17.0)",
              "status": "A category such as Normal, High, or Low based on the reference range"
            }
          ]
        }
        
        Ensure that the output is ONLY valid JSON with no markdown wrapping outside the JSON structure. The 'summary' field value itself should contain valid Markdown string (with newlines escaped as \\n).
        """
        
        if record_info:
            prompt += f"\n\nHere is the metadata for this record:\n{record_info}"
            
        return prompt

    async def _call_groq(self, payload: dict, parse_json: bool = True) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            for attempt in range(3):
                # Update payload to use currently resolved models before sending
                if "messages" in payload and payload.get("messages") and isinstance(payload["messages"][0]["content"], list):
                    # It's a vision payload
                    payload["model"] = self.vision_model
                else:
                    payload["model"] = self.text_model

                resp = await client.post(self.base_url, json=payload, headers=headers)
                
                if resp.status_code == 200:
                    break
                    
                # If error, try resolving models again to get a new one, then loop
                logger.error(f"Groq API Error ({resp.status_code}) on model {payload.get('model')}: {resp.text}")
                self._models_resolved = False
                await self._resolve_models()
                
                if attempt == 2:
                    raise Exception(f"Groq API Error ({resp.status_code}): {resp.text}")
                    
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            
            if parse_json:
                try:
                    # Try to strip markdown if the model wrapped it
                    content = content.strip()
                    if content.startswith("```json"):
                        content = content.replace("```json", "", 1)
                    if content.endswith("```"):
                        content = content[:-3]
                    content = content.strip()
                    
                    return json.loads(content)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse JSON from Groq. Raw content: {content}")
                    raise Exception("AI did not return valid JSON.")
            return content

document_ai_service = DocumentAIService()
