"""
LifeOS Backend — Application Configuration
Loads environment variables using Pydantic Settings.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    APP_NAME: str = "LifeOS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://postgres:xxxx@localhost:xxxx/lifeos_mobile_db"

    # --- JWT Authentication ---
    SECRET_KEY: str = "change-this-to-a-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # --- AI Settings ---
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    OPENAI_API_KEY: str = ""
    OPENAI_VISION_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = ""  # Leave empty to auto-detect best available Flash model

    # --- Google Sign In ---
    GOOGLE_CLIENT_ID: str = "749609290729-7p9u9ujo98odpldasobtvqascmvejumb.apps.googleusercontent.com"

    # --- Fitbit Integration ---
    FITBIT_CLIENT_ID: str = ""
    FITBIT_CLIENT_SECRET: str = ""

    # --- Email Service (SMTP) ---
    SMTP_EMAIL: str = ""
    SMTP_PASSWORD: str = ""

    # --- Twilio SMS Service ---
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # --- File Uploads ---
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    MAX_FILE_SIZE_MB: int = 10

    # --- OneSignal Push Notifications ---
    ONESIGNAL_APP_ID: str = ""
    ONESIGNAL_REST_API_KEY: str = ""

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:5173,http://127.0.0.1:5173"

    # --- External URLs ---
    PUBLIC_API_URL: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    s = Settings()
    if not os.path.isabs(s.UPLOAD_DIR):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        s.UPLOAD_DIR = os.path.normpath(os.path.join(base_dir, s.UPLOAD_DIR))
    return s
