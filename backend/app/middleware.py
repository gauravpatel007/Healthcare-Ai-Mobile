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

# ── In-memory blocked-IP cache (avoids a DB query on every single request) ──
_blocked_ips_cache: set[str] = set()  # set of blocked IP strings
_blocked_ips_ts: float = 0.0          # last refresh timestamp
_BLOCKED_IPS_TTL = 60.0              # refresh every 60 seconds


async def _refresh_blocked_ips():
    """Reload blocked IPs from DB into the in-memory set."""
    global _blocked_ips_cache, _blocked_ips_ts
    try:
        import datetime
        now = datetime.datetime.utcnow()
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(BlockedIP))
            all_blocked = result.scalars().all()
            # Only include non-expired blocks
            _blocked_ips_cache = {
                b.ip_address for b in all_blocked
                if not b.expires_at or b.expires_at.replace(tzinfo=None) >= now
            }
        _blocked_ips_ts = time.time()
    except Exception as e:
        logger.error(f"Failed to refresh blocked IP cache: {e}")


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
    """Block requests from IP addresses in the BlockedIP table.
    Uses an in-memory cache refreshed every 60s to avoid per-request DB hits."""
    global _blocked_ips_ts
    client_ip = request.client.host if request.client else None
    if client_ip:
        # Refresh cache if stale
        if time.time() - _blocked_ips_ts > _BLOCKED_IPS_TTL:
            await _refresh_blocked_ips()
        if client_ip in _blocked_ips_cache:
            logger.warning(f"Blocked request from IP: {client_ip}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Your IP address has been blocked."}
            )

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

