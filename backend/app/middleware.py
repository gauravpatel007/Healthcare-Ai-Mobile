"""
LifeOS Backend — Middleware
CORS configuration and request logging middleware.
"""

import logging
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.user import BlockedIP

logger = logging.getLogger("lifeos")


def setup_cors(app: FastAPI) -> None:
    """Configure CORS middleware."""
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=r"^(https?://.*|capacitor://.*|ionic://.*)$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )


async def logging_middleware(request: Request, call_next):
    """Log every request with timing information."""
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)

    logger.info(
        "%s %s → %d (%sms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    return response


async def ip_blocking_middleware(request: Request, call_next):
    """Block requests from IP addresses in the BlockedIP table."""
    client_ip = request.client.host if request.client else None
    if client_ip:
        try:
            async with AsyncSessionLocal() as db:
                blocked_ip_result = await db.execute(
                    select(BlockedIP).where(BlockedIP.ip_address == client_ip)
                )
                blocked = blocked_ip_result.scalar_one_or_none()
                if blocked:
                    import datetime
                    if blocked.expires_at and blocked.expires_at.replace(tzinfo=None) < datetime.datetime.utcnow():
                        # expired block, allow
                        pass
                    else:
                        logger.warning(f"Blocked request from IP: {client_ip}")
                        return JSONResponse(
                            status_code=403,
                            content={"detail": "Your IP address has been blocked."}
                        )
        except Exception as e:
            logger.error(f"Error checking blocked IP: {e}")
            
    return await call_next(request)


def setup_logging() -> None:
    """Configure structured logging for the application."""
    settings = get_settings()
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # Suppress noisy third-party loggers
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
