"""
# Trigger reload to ensure new schemas are loaded
LifeOS Backend — FastAPI Application Entry Point
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import close_db, init_db
from app.exceptions import register_exception_handlers
from app.middleware import logging_middleware, setup_cors, setup_logging

# Import all models so they're registered with Base.metadata
import app.models  # noqa: F401

# Import routers
from app.routers import (
    ai_assistant, ai_fitness, ai_mental, ai_nutrition, ai_symptom,
    analytics, appointments, auth, challenges, dashboard, emergency,
    expenses, family, health_trackers, medical_records, medicines, users, share, vision,
    gamification,
    admin, admin_fitness, admin_medicine, admin_disease,
    admin_content, admin_notifications, admin_feedback, admin_diet,
    admin_settings, admin_files, admin_security, admin_audit, admin_analytics,
    user_feedback, user_notifications, document_analysis, reminders
)

logger = logging.getLogger("lifeos")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Application startup and shutdown events."""
    setup_logging()
    settings = get_settings()
    logger.info("🚀 Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)

    # Start background scheduler
    import asyncio
    from app.services.scheduler import check_medications_loop
    # Run DB migration for AI models and MealPlans
    try:
        pass
    except Exception as e:
        logger.error(f"Migration failed: {e}")

    # Run DB migration for AI models and MealPlans
    try:
        pass
    except Exception as e:
        logger.error(f"Migration failed: {e}")

    # Create upload directory
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # Initialize database tables
    await init_db()
    scheduler_task = asyncio.create_task(check_medications_loop())
    logger.info("✅ Database tables initialized")

    yield

    # Shutdown
    scheduler_task.cancel()
    await close_db()
    logger.info(" %s shutdown complete", settings.APP_NAME)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    application = FastAPI(
        title=f"{settings.APP_NAME} API",
        description=(
            "**LifeOS** — AI-Powered Healthcare Operating System\n\n"
            "A comprehensive healthcare management platform providing:\n"
            "- 🔐 JWT Authentication with role-based access\n"
            "- 📋 Medical Records with file uploads\n"
            "- 💊 Medicine management with interaction checks\n"
            "- 📅 Appointment scheduling\n"
            "- 🆘 Emergency contacts & SOS system\n"
            "- 👨‍👩‍👧 Family health management\n"
            "- 📊 Smart analytics & health predictions\n"
            "- 🤖 AI-powered health assistant (Groq)\n"
            "- 🔍 AI Symptom checker\n"
            "- 🥗 AI Nutrition planner\n"
            "- 💪 AI Fitness coach\n"
            "- 🧠 AI Mental health support"
        ),
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ─── Middleware ──────────────────────────────────────────────────
    setup_cors(application)
    application.middleware("http")(logging_middleware)
    from app.middleware import ip_blocking_middleware
    application.middleware("http")(ip_blocking_middleware)

    # ─── Exception Handlers ─────────────────────────────────────────
    register_exception_handlers(application)

    # ─── API Routers (all under /api/v1) ────────────────────────────
    api_prefix = "/api/v1"

    application.include_router(auth.router, prefix=api_prefix)
    application.include_router(users.router, prefix=api_prefix)
    application.include_router(dashboard.router, prefix=api_prefix)
    application.include_router(medical_records.router, prefix=api_prefix)
    application.include_router(medicines.router, prefix=api_prefix)
    application.include_router(reminders.router, prefix=api_prefix)
    application.include_router(appointments.router, prefix=api_prefix)
    application.include_router(emergency.router, prefix=api_prefix)
    application.include_router(family.router, prefix=api_prefix)
    application.include_router(health_trackers.router, prefix=api_prefix)
    application.include_router(expenses.router, prefix=api_prefix)
    application.include_router(challenges.router, prefix=api_prefix)
    application.include_router(gamification.router, prefix=api_prefix)
    application.include_router(analytics.router, prefix=api_prefix)
    application.include_router(share.router, prefix=api_prefix)
    application.include_router(ai_assistant.router, prefix=api_prefix)
    application.include_router(ai_symptom.router, prefix=api_prefix)
    application.include_router(ai_nutrition.router, prefix=api_prefix)
    application.include_router(ai_fitness.router, prefix=api_prefix)
    application.include_router(ai_mental.router, prefix=api_prefix)
    application.include_router(vision.router, prefix=api_prefix)
    application.include_router(admin.router, prefix=api_prefix)
    application.include_router(admin_fitness.router, prefix=api_prefix)
    application.include_router(admin_medicine.router, prefix=api_prefix)
    application.include_router(admin_disease.router, prefix=api_prefix)
    application.include_router(admin_content.router, prefix=api_prefix)
    application.include_router(admin_notifications.router, prefix=api_prefix)
    application.include_router(admin_feedback.router, prefix=api_prefix)
    application.include_router(admin_diet.router, prefix=api_prefix)
    application.include_router(admin_settings.router, prefix=api_prefix)
    application.include_router(admin_files.router, prefix=api_prefix)
    application.include_router(admin_security.router, prefix=api_prefix)
    application.include_router(admin_audit.router, prefix=api_prefix)
    application.include_router(admin_analytics.router, prefix=api_prefix)
    application.include_router(document_analysis.router, prefix=api_prefix)

    # User Modules
    application.include_router(user_feedback.router, prefix=api_prefix)
    application.include_router(user_notifications.router, prefix=api_prefix)

    # ─── Static Files (Uploads) ─────────────────────────────────────
    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    application.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

    # ─── Root Health Check ──────────────────────────────────────────
    @application.get("/", tags=["Health Check"])
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "healthy",
            "docs": "/docs",
        }

    @application.get("/health", tags=["Health Check"])
    async def health_check():
        return {"status": "ok"}

    return application


# Create the app instance
app = create_app()
