"""
LifeOS Backend — Database Configuration
SQLAlchemy async engine, session factory, and base model.
"""

import uuid
from datetime import datetime, timezone

# pyrefly: ignore [missing-import]
from sqlalchemy import DateTime
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings

settings = get_settings()

from uuid import uuid4
# pyrefly: ignore [missing-import]
from sqlalchemy.pool import NullPool

connect_args = {}
if ":6543" in settings.DATABASE_URL:
    # Supabase Transaction Pooler (port 6543) configuration:
    # 1. NullPool: let Supavisor handle pooling to avoid client limits & connection leaks
    # 2. Disable statement caches
    # 3. Unique statement names to eliminate DuplicatePreparedStatementError
    connect_args["statement_cache_size"] = 0
    connect_args["prepared_statement_cache_size"] = 0
    connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid4().hex}__"
    engine_kwargs = {
        "echo": settings.DEBUG,
        "poolclass": NullPool,
        "connect_args": connect_args,
    }
else:
    engine_kwargs = {
        "echo": settings.DEBUG,
        "pool_pre_ping": True,
        "pool_recycle": 180,
        "pool_size": 3,
        "max_overflow": 2,
        "pool_timeout": 30,
        "connect_args": connect_args,
    }

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class TimestampMixin:
    """Mixin providing created_at and updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


async def get_db():
    """Dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables (for development only; use Alembic in production)."""
    import logging
    logger = logging.getLogger("lifeos")
    try:
        async with engine.begin() as conn:
            try:
                await conn.run_sync(Base.metadata.create_all)
            except Exception as e:
                logger.warning(f"Table reflection / creation warning during init_db: {e}")
                
        # Run a separate transaction just for reminder tables to ensure they exist
        async with engine.begin() as conn:
            try:
                from app.models.reminder import ReminderSettings, MedicineDose, ReminderAction, ReminderNotice
                await conn.run_sync(
                    Base.metadata.create_all, 
                    tables=[
                        ReminderSettings.__table__, 
                        MedicineDose.__table__,
                        ReminderAction.__table__,
                        ReminderNotice.__table__
                    ]
                )
            except Exception as rem_err:
                logger.warning(f"Reminder tables creation warning: {rem_err}")

            # pyrefly: ignore [missing-import]
            from sqlalchemy import text
            try:
                await conn.execute(text("ALTER TABLE medicine_reminder_notices ADD COLUMN IF NOT EXISTS push_sent BOOLEAN NOT NULL DEFAULT FALSE"))
                await conn.execute(text("ALTER TABLE medicine_reminder_notices ADD COLUMN IF NOT EXISTS push_attempts INTEGER NOT NULL DEFAULT 0"))
                await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS carrier VARCHAR(50);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;"))
                await conn.execute(text("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_alerts_enabled BOOLEAN DEFAULT TRUE;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS connected_devices JSON DEFAULT '[]'::json;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS fitbit_access_token TEXT;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS fitbit_refresh_token TEXT;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS step_goal INTEGER NOT NULL DEFAULT 10000;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS target_weight FLOAT;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS target_weight_timeline VARCHAR(100);"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS calorie_goal INTEGER;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS burn_calorie_goal INTEGER NOT NULL DEFAULT 500;"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS measurement_unit VARCHAR(10) NOT NULL DEFAULT 'metric';"))
                await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_preferences JSON NOT NULL DEFAULT '{}';"))
                await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ai_prep_notes TEXT;"))
                await conn.execute(text("ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS family_member_id VARCHAR(36);"))
                await conn.execute(text("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS feedback INTEGER;"))
                try:
                    # For PostgreSQL to update the ENUM
                    await conn.execute(text("ALTER TYPE health_category ADD VALUE IF NOT EXISTS 'mindfulness';"))
                except Exception:
                    pass
            except Exception as mig_err:
                logger.warning(f"DB Migration step skipped: {mig_err}")

            # ── Performance indexes (idempotent) ───────────────────────────
            try:
                perf_indexes = [
                    "CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips (ip_address);",
                    "CREATE INDEX IF NOT EXISTS idx_medicines_user_active ON medicines (user_id, is_active);",
                    "CREATE INDEX IF NOT EXISTS idx_medical_records_user_created ON medical_records (user_id, created_at DESC);",
                    "CREATE INDEX IF NOT EXISTS idx_appointments_user_status_date ON appointments (user_id, status, date);",
                    "CREATE INDEX IF NOT EXISTS idx_health_entries_user_cat_time ON health_entries (user_id, category, recorded_at);",
                    "CREATE INDEX IF NOT EXISTS idx_medicine_logs_user_date ON medicine_logs (user_id, date);",
                    "CREATE INDEX IF NOT EXISTS idx_medicine_reminder_notices_user ON medicine_reminder_notices (user_id, scheduled_time);",
                ]
                for idx_sql in perf_indexes:
                    try:
                        await conn.execute(text(idx_sql))
                    except Exception:
                        pass  # Index may already exist or table may not exist yet
                logger.info("✅ Performance indexes verified")
            except Exception as idx_err:
                logger.warning(f"Index creation skipped: {idx_err}")
    except Exception as e:
        logger.error(f"Database initialization encountered an error: {e}")


async def close_db():
    """Dispose of the engine connection pool."""
    await engine.dispose()
